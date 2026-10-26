import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import { parseStarterVoiceManifest, starterVoiceKeys } from '../src/voice/starterVoiceManifest.js'

const prisma = new PrismaClient()
const prismaRoot = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(prismaRoot, '..')
const workspaceRoot = path.resolve(serverRoot, '..', '..')
dotenv.config({ path: path.join(serverRoot, '.env') })

function sha256(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

async function main() {
  const manifestPath = path.join(workspaceRoot, 'assets', 'voice-packs', 'dreamchord-starter', 'manifest.json')
  const manifest = parseStarterVoiceManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  const user = await prisma.user.findUnique({ where: { username: 'demo' } })
  if (!user) throw new Error('未找到 demo 用户，请先运行 pnpm db:seed')

  const configuredUploadRoot = process.env.UPLOAD_DIR || './uploads'
  const uploadRoot = path.isAbsolute(configuredUploadRoot) ? configuredUploadRoot : path.resolve(serverRoot, configuredUploadRoot)
  const relativeDirectory = path.join('library', user.id, 'voice-starter')
  const destinationDirectory = path.join(uploadRoot, relativeDirectory)
  mkdirSync(destinationDirectory, { recursive: true })

  for (const voice of manifest.voices) {
    const source = path.resolve(path.dirname(manifestPath), voice.outputFile)
    if (!existsSync(source)) throw new Error(`缺少起始音色文件：${source}；请先运行 pnpm voice:starter:generate`)
    const actualHash = sha256(source)
    if (actualHash !== voice.sha256) throw new Error(`${voice.name} 的 SHA256 与清单不一致，拒绝导入`)

    const filename = `${voice.id}.wav`
    const destination = path.join(destinationDirectory, filename)
    copyFileSync(source, destination)
    const url = `/uploads/${path.join(relativeDirectory, filename).replaceAll('\\', '/')}`
    const keys = starterVoiceKeys(voice)
    const provenance = {
      starterVoice: {
        packId: manifest.packId,
        sourceModel: manifest.sourceModel,
        sourceVoiceId: voice.sourceVoiceId,
        sourceLicense: manifest.sourceLicense,
        sourceUrl: manifest.sourceUrl,
        syntheticSource: manifest.syntheticSource,
        generatedAt: manifest.generatedAt,
        sha256: voice.sha256,
        durationSeconds: voice.durationSeconds,
      },
      voiceSample: {
        consentConfirmed: true,
        transcript: voice.transcript,
        language: voice.language,
        style: voice.tags.join('、'),
        syntheticSource: true,
      },
    }

    await prisma.$transaction(async (tx) => {
      await tx.asset.upsert({
        where: { id: keys.assetId },
        update: { ownerId: user.id, name: `${voice.name} · 合成参考音`, type: 'VOICE_SAMPLE', url, mimeType: 'audio/wav', metadata: JSON.stringify(provenance), status: 'ready' },
        create: { id: keys.assetId, ownerId: user.id, name: `${voice.name} · 合成参考音`, type: 'VOICE_SAMPLE', url, mimeType: 'audio/wav', metadata: JSON.stringify(provenance), status: 'ready' },
      })
      await tx.voiceProfile.upsert({
        where: { id: keys.profileId },
        update: {
          ownerId: user.id, name: voice.name, description: voice.description, language: voice.language, ageTone: voice.ageTone,
          genderTone: voice.genderTone, tags: JSON.stringify(voice.tags), provider: 'gpt-sovits', status: 'active', previewUrl: url,
          authorizationNote: `DreamChord 内置合成起始音色，源自 ${manifest.sourceModel}/${voice.sourceVoiceId}（${manifest.sourceLicense}）；非真人声音克隆。`,
        },
        create: {
          id: keys.profileId, ownerId: user.id, name: voice.name, description: voice.description, language: voice.language,
          ageTone: voice.ageTone, genderTone: voice.genderTone, tags: JSON.stringify(voice.tags), provider: 'gpt-sovits', status: 'active', previewUrl: url,
          authorizationNote: `DreamChord 内置合成起始音色，源自 ${manifest.sourceModel}/${voice.sourceVoiceId}（${manifest.sourceLicense}）；非真人声音克隆。`,
        },
      })
      await tx.voiceReference.upsert({
        where: { id: keys.referenceId },
        update: { profileId: keys.profileId, assetId: keys.assetId, transcript: voice.transcript, language: voice.language, emotion: '自然', authorizationConfirmed: true, status: 'active' },
        create: { id: keys.referenceId, profileId: keys.profileId, assetId: keys.assetId, transcript: voice.transcript, language: voice.language, emotion: '自然', authorizationConfirmed: true, status: 'active' },
      })
    })
    console.log(`✓ ${voice.name} 已导入声音库 (${voice.durationSeconds.toFixed(1)}s)`)
  }

  console.log(`起始音色同步完成：${manifest.voices.length} 个，可安全重复执行。`)
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(async () => prisma.$disconnect())
