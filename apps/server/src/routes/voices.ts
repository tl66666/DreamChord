import { Router, type Response, type Router as ExpressRouter } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { resolveVoiceDirection, VOICE_EMOTION_LABELS } from '../voice/voiceDirectionService.js'
import { storagePathFromUrl, uploadUrl } from '../assets/storagePaths.js'
import { prisma } from '../lib/prisma.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { GptSovitsProvider } from '../voice/gptSovitsProvider.js'
import { CosyVoiceProvider } from '../voice/cosyVoiceProvider.js'
import { getManagedVoiceEngine, type ManagedVoiceEngine } from '../voice/managedVoiceEngine.js'
import type { VoiceProvider } from '../voice/provider.js'
import { readVoiceProviderConfig } from '../voice/providerConfig.js'
import { SerialVoiceQueue } from '../voice/voiceQueue.js'
import {
  acceptVoiceGenerationSchema,
  attachVoiceReferenceSchema,
  bindCharacterVoiceSchema,
  createVoiceGenerationSchema,
  createVoiceProfileSchema,
  updateVoiceProfileSchema,
} from '../voice/voiceSchemas.js'

const defaultVoiceQueue = new SerialVoiceQueue()

function configuredProvider(): VoiceProvider | null {
  const config = readVoiceProviderConfig()
  if (!config.enabled) return null
  return config.provider === 'cosyvoice' ? new CosyVoiceProvider(config) : new GptSovitsProvider(config)
}

const includeProfileDetails = {
  references: { include: { asset: true }, orderBy: { createdAt: 'desc' as const } },
  bindings: { include: { character: true, project: { select: { id: true, title: true } } } },
}

export function createVoiceRouter(
  client: PrismaClient = prisma,
  provider: VoiceProvider | null = configuredProvider(),
  options: { storageRoot?: string; queue?: SerialVoiceQueue; engine?: ManagedVoiceEngine } = {},
): ExpressRouter {
  const router: ExpressRouter = Router()
  const storageRoot = options.storageRoot || process.env.UPLOAD_DIR || './uploads'
  const queue = options.queue || defaultVoiceQueue
  const engine = options.engine || getManagedVoiceEngine()
  router.use(authenticateToken)

  router.get('/provider/health', async (_req: AuthRequest, res: Response) => {
    if (!provider) {
      const config = readVoiceProviderConfig()
      return res.json({ ok: false, provider: 'none', message: config.enabled ? '声音服务不可用' : config.reason, engine: engine.status() })
    }
    const health = await provider.health()
    if (health.ok) engine.markRunning()
    res.json({ ...health, capabilities: provider.capabilities, engine: engine.status() })
  })

  router.post('/provider/start', (_req: AuthRequest, res: Response) => {
    try { res.status(202).json(engine.start()) }
    catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : '声音引擎无法启动', engine: engine.status() }) }
  })

  router.post('/provider/stop', (_req: AuthRequest, res: Response) => {
    res.json(engine.stop())
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
        ownerId: req.userId!, provider: provider?.id || 'gpt-sovits', name: input.name, description: input.description,
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

  router.get('/jobs', async (req: AuthRequest, res: Response) => {
    const profileId = typeof req.query.profileId === 'string' ? req.query.profileId : undefined
    res.json(await client.voiceGenerationJob.findMany({
      where: { ownerId: req.userId!, ...(profileId ? { profileId } : {}) },
      include: {
        character: { select: { id: true, name: true } },
        profile: { select: { id: true, name: true } },
        acceptedAsset: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }))
  })

  router.get('/jobs/:jobId', async (req: AuthRequest, res: Response) => {
    const job = await client.voiceGenerationJob.findFirst({
      where: { id: req.params.jobId, ownerId: req.userId! },
      include: {
        character: { select: { id: true, name: true } },
        profile: { select: { id: true, name: true } },
        acceptedAsset: true,
      },
    })
    if (!job) return res.status(404).json({ error: '生成任务不存在' })
    res.json(job)
  })

  router.post('/generate', async (req: AuthRequest, res: Response) => {
    if (!provider) return res.status(503).json({ error: '请先配置并启动 DreamChord 本机声音引擎' })
    const parsed = createVoiceGenerationSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || '配音生成参数无效' })
    const input = parsed.data
    const userId = req.userId!
    const [project, character, binding, reference] = await Promise.all([
      client.project.findFirst({ where: { id: input.projectId, authorId: userId } }),
      client.character.findFirst({ where: { id: input.characterId, projectId: input.projectId } }),
      client.characterVoiceBinding.findFirst({ where: { characterId: input.characterId, projectId: input.projectId } }),
      client.voiceReference.findFirst({
        where: { id: input.referenceId, status: 'active', authorizationConfirmed: true, profile: { ownerId: userId, status: 'active' }, asset: { ownerId: userId, type: 'VOICE_SAMPLE' } },
        include: { asset: true },
      }),
    ])
    if (!project || !character) return res.status(403).json({ error: '角色不属于你的项目' })
    if (input.chapterId) {
      const chapter = await client.chapter.findFirst({ where: { id: input.chapterId, projectId: project.id } })
      if (!chapter) return res.status(400).json({ error: '章节不属于当前项目' })
    }
    if (!binding) return res.status(409).json({ error: '请先给角色绑定一个音色' })
    if (!reference || reference.profileId !== binding.profileId || reference.asset.ownerId !== userId) {
      return res.status(400).json({ error: '请选择当前角色音色中的授权参考片段' })
    }
    let referencePath: string
    try { referencePath = storagePathFromUrl(storageRoot, reference.asset.url) }
    catch { return res.status(400).json({ error: '参考音频路径无效，请重新上传' }) }

    const direction = resolveVoiceDirection({ role: character.name, text: input.text, mode: input.directionMode, emotion: input.emotion, speed: input.speed })
    const job = await client.voiceGenerationJob.create({ data: {
      ownerId: userId, projectId: project.id, characterId: character.id,
      ...(input.chapterId ? { chapterId: input.chapterId } : {}),
      ...(input.nodeId ? { nodeId: input.nodeId } : {}),
      profileId: binding.profileId, referenceId: reference.id,
      text: input.text, language: input.language, emotion: VOICE_EMOTION_LABELS[direction.emotion],
      speed: direction.pace, ...(input.seed !== undefined ? { seed: input.seed } : {}), status: 'queued',
      providerMetadata: JSON.stringify({ provider: provider.id, direction, textHash: direction.textHash, referenceId: reference.id }),
    } })

    void queue.enqueue(async () => {
      await client.voiceGenerationJob.update({ where: { id: job.id }, data: { status: 'running', errorMessage: null } })
      const result = await provider.synthesize({
        text: input.text, textLanguage: input.language, referencePath,
        promptText: reference.transcript, promptLanguage: reference.language,
        speed: direction.pace, ...(input.seed !== undefined ? { seed: input.seed } : {}), direction,
      })
      const relative = path.join('library', userId, 'voice-generated', `${randomUUID()}.wav`)
      const outputPath = path.resolve(storageRoot, relative)
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, result.bytes)
      await client.voiceGenerationJob.update({ where: { id: job.id }, data: {
        status: 'completed', outputUrl: uploadUrl(relative), outputMimeType: result.mimeType,
        seed: result.seed ?? input.seed, completedAt: new Date(),
        providerMetadata: JSON.stringify({
          provider: provider.id,
          capabilities: provider.capabilities,
          direction, textHash: direction.textHash, referenceId: reference.id,
          ...result.providerMetadata,
        }),
      } })
    }).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : '配音生成失败'
      try {
        await client.voiceGenerationJob.update({ where: { id: job.id }, data: {
          status: 'failed', errorMessage: message.slice(0, 500), completedAt: new Date(),
        } })
      } catch (updateError) { console.error('记录配音生成失败状态时出错', updateError) }
    })

    res.status(202).json(job)
  })

  router.post('/jobs/:jobId/accept', async (req: AuthRequest, res: Response) => {
    const parsed = acceptVoiceGenerationSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || '素材名称无效' })
    const job = await client.voiceGenerationJob.findFirst({
      where: { id: req.params.jobId, ownerId: req.userId! },
      include: { character: { select: { name: true } }, profile: { select: { name: true } } },
    })
    if (!job) return res.status(404).json({ error: '生成任务不存在' })
    if (job.status !== 'completed' || !job.outputUrl || !job.outputMimeType) return res.status(409).json({ error: '配音尚未生成完成' })
    if (job.acceptedAssetId) return res.status(409).json({ error: '该候选已经收入素材库' })
    const asset = await client.asset.create({ data: {
      ownerId: req.userId!, projectId: job.projectId,
      name: parsed.data.name || `${job.character.name}-${job.text.slice(0, 20)}`,
      type: 'VOICE', url: job.outputUrl, mimeType: job.outputMimeType,
      metadata: JSON.stringify({ voiceGeneration: {
        jobId: job.id, profileId: job.profileId, profileName: job.profile.name,
        characterId: job.characterId, text: job.text, emotion: job.emotion, speed: job.speed,
        ...JSON.parse(job.providerMetadata || '{}'),
      } }),
    } })
    await client.voiceGenerationJob.update({ where: { id: job.id }, data: { acceptedAssetId: asset.id } })
    res.json(asset)
  })

  return router
}

