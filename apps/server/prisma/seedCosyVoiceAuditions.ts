import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { OFFICIAL_DEMO } from '@dreamchord/story-domain'
import { parseStarterVoiceManifest, starterVoiceKeys } from '../src/voice/starterVoiceManifest.js'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(serverRoot, '..', '..')
dotenv.config({ path: path.join(serverRoot, '.env') })
const prisma = new PrismaClient()

async function main() {
  const manifest = parseStarterVoiceManifest(JSON.parse(await readFile(path.join(root, 'assets/voice-packs/dreamchord-starter/manifest.json'), 'utf8')))
  const report = JSON.parse(await readFile(path.join(root, '.runtime/voice-auditions/cosyvoice-smoke-report.json'), 'utf8')) as {
    model: string; takes: Array<{ voiceId: string; role: string; text: string; output: string; direction: { emotion: string; pace: number; textHash: string }; durationSeconds: number; generationSeconds: number; clippedSamples: number }>
  }
  const owner = await prisma.user.findUnique({ where: { username: 'demo' } })
  if (!owner) throw new Error('请先初始化 demo 账号。')
  const project = await prisma.project.findFirst({ where: { id: OFFICIAL_DEMO.id, authorId: owner.id }, include: { characters: true } })
  if (!project) throw new Error('官方示例项目不存在。')
  const uploadRoot = path.resolve(serverRoot, process.env.UPLOAD_DIR || './uploads')
  const relativeDirectory = path.join('library', owner.id, 'voice-auditions')
  await mkdir(path.join(uploadRoot, relativeDirectory), { recursive: true })

  for (const take of report.takes) {
    const voice = manifest.voices.find((item) => item.id === take.voiceId)
    const character = project.characters.find((item) => item.name === take.role)
    if (!voice || !character) throw new Error(`缺少 ${take.role} 的音色或角色。`)
    const keys = starterVoiceKeys(voice)
    const reference = await prisma.voiceReference.findFirst({ where: { id: keys.referenceId, authorizationConfirmed: true, profile: { ownerId: owner.id } } })
    if (!reference) throw new Error(`${take.role} 的声音参考尚未导入。请运行 pnpm voice:seed。`)
    const jobId = `cosyvoice-audition-${take.voiceId}`
    const existing = await prisma.voiceGenerationJob.findUnique({ where: { id: jobId } })
    if (existing?.acceptedAssetId) {
      console.log(`${take.role}：已有确认素材，保留原候选。`)
      continue
    }
    const source = path.resolve(root, take.output)
    const expectedDirectory = path.join(root, '.runtime', 'voice-auditions') + path.sep
    if (!source.startsWith(expectedDirectory) || !source.endsWith('.wav')) throw new Error('试听文件路径越界。')
    const filename = `${take.voiceId}-cosyvoice.wav`
    await copyFile(source, path.join(uploadRoot, relativeDirectory, filename))
    const outputUrl = `/uploads/${path.join(relativeDirectory, filename).replaceAll('\\', '/')}`
    const data = {
      ownerId: owner.id, projectId: project.id, characterId: character.id,
      profileId: keys.profileId, referenceId: reference.id,
      text: take.text, language: 'zh', emotion: take.direction.emotion, speed: take.direction.pace,
      status: 'completed', outputUrl, outputMimeType: 'audio/wav', completedAt: new Date(),
      providerMetadata: JSON.stringify({
        provider: 'cosyvoice', model: report.model, direction: take.direction, textHash: take.direction.textHash,
        referenceId: reference.id, sourceModel: manifest.sourceModel, syntheticSource: true,
        quality: { durationSeconds: take.durationSeconds, clippedSamples: take.clippedSamples, expressiveReview: 'pending' },
      }),
    }
    await prisma.voiceGenerationJob.upsert({ where: { id: jobId }, create: { id: jobId, ...data }, update: data })
    console.log(`${take.role}：已加入声音库「最近生成」，等待试听确认。`)
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
