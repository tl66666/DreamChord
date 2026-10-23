import { Router, type Response, type Router as ExpressRouter } from 'express'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { GptSovitsProvider } from '../voice/gptSovitsProvider.js'
import type { VoiceProvider } from '../voice/provider.js'
import { readVoiceProviderConfig } from '../voice/providerConfig.js'
import {
  attachVoiceReferenceSchema,
  bindCharacterVoiceSchema,
  createVoiceProfileSchema,
  updateVoiceProfileSchema,
} from '../voice/voiceSchemas.js'

function configuredProvider(): VoiceProvider | null {
  const config = readVoiceProviderConfig()
  return config.enabled ? new GptSovitsProvider(config) : null
}

const includeProfileDetails = {
  references: { include: { asset: true }, orderBy: { createdAt: 'desc' as const } },
  bindings: { include: { character: true, project: { select: { id: true, title: true } } } },
}

export function createVoiceRouter(client: PrismaClient = prisma, provider: VoiceProvider | null = configuredProvider()): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(authenticateToken)

  router.get('/provider/health', async (_req: AuthRequest, res: Response) => {
    if (!provider) {
      const config = readVoiceProviderConfig()
      return res.json({ ok: false, provider: 'none', message: config.enabled ? '声音服务不可用' : config.reason })
    }
    res.json(await provider.health())
  })

  router.get('/profiles', async (req: AuthRequest, res: Response) => {
    res.json(await client.voiceProfile.findMany({
      where: { ownerId: req.userId! },
      include: includeProfileDetails,
      orderBy: { createdAt: 'desc' },
    }))
  })

  router.post('/profiles', async (req: AuthRequest, res: Response) => {
    const parsed = createVoiceProfileSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || '音色档案参数无效' })
    const input = parsed.data
    const profile = await client.voiceProfile.create({
      data: {
        ownerId: req.userId!, provider: 'gpt-sovits', name: input.name, description: input.description,
        language: input.language, ageTone: input.ageTone, genderTone: input.genderTone,
        tags: JSON.stringify(input.tags), defaultEmotion: input.defaultEmotion,
        defaultSpeed: input.defaultSpeed, authorizationNote: input.authorizationNote,
      },
      include: includeProfileDetails,
    })
    res.status(201).json(profile)
  })

  router.patch('/profiles/:profileId', async (req: AuthRequest, res: Response) => {
    const parsed = updateVoiceProfileSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || '音色档案参数无效' })
    const existing = await client.voiceProfile.findFirst({ where: { id: req.params.profileId, ownerId: req.userId! } })
    if (!existing) return res.status(404).json({ error: '音色档案不存在' })
    const { tags, ...input } = parsed.data
    res.json(await client.voiceProfile.update({
      where: { id: existing.id },
      data: { ...input, ...(tags ? { tags: JSON.stringify(tags) } : {}) },
      include: includeProfileDetails,
    }))
  })

  router.post('/profiles/:profileId/references', async (req: AuthRequest, res: Response) => {
    const parsed = attachVoiceReferenceSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || '参考片段参数无效' })
    const profile = await client.voiceProfile.findFirst({ where: { id: req.params.profileId, ownerId: req.userId! } })
    if (!profile) return res.status(404).json({ error: '音色档案不存在' })
    if (profile.status !== 'active') return res.status(409).json({ error: '该音色已停用或撤销，不能添加参考片段' })
    const asset = await client.asset.findFirst({ where: { id: parsed.data.assetId, ownerId: req.userId!, type: 'VOICE_SAMPLE' } })
    if (!asset) return res.status(400).json({ error: '请选择自己声音库中的角色声音样本' })
    const { authorizationConfirmed, ...reference } = parsed.data
    res.status(201).json(await client.voiceReference.create({
      data: { ...reference, profileId: profile.id, authorizationConfirmed },
      include: { asset: true },
    }))
  })

  router.post('/profiles/:profileId/bindings', async (req: AuthRequest, res: Response) => {
    const parsed = bindCharacterVoiceSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || '角色绑定参数无效' })
    const [profile, project, character] = await Promise.all([
      client.voiceProfile.findFirst({ where: { id: req.params.profileId, ownerId: req.userId!, status: 'active' } }),
      client.project.findFirst({ where: { id: parsed.data.projectId, authorId: req.userId! } }),
      client.character.findFirst({ where: { id: parsed.data.characterId, projectId: parsed.data.projectId } }),
    ])
    if (!profile) return res.status(404).json({ error: '可用音色档案不存在' })
    if (!project || !character) return res.status(403).json({ error: '角色不属于你的项目' })
    res.json(await client.characterVoiceBinding.upsert({
      where: { characterId: character.id },
      create: { characterId: character.id, projectId: project.id, profileId: profile.id },
      update: { profileId: profile.id },
      include: { character: true, project: { select: { id: true, title: true } } },
    }))
  })

  router.delete('/bindings/:bindingId', async (req: AuthRequest, res: Response) => {
    const binding = await client.characterVoiceBinding.findFirst({
      where: { id: req.params.bindingId, project: { authorId: req.userId! } },
    })
    if (!binding) return res.status(404).json({ error: '声音绑定不存在' })
    await client.characterVoiceBinding.delete({ where: { id: binding.id } })
    res.status(204).end()
  })

  return router
}

export default createVoiceRouter()

