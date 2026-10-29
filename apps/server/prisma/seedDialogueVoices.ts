import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import { dialogueVoiceKeys, parseDialogueVoiceManifest } from '../src/voice/dialogueVoiceManifest.js'

const prisma = new PrismaClient()
const prismaRoot = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(prismaRoot, '..')
const workspaceRoot = path.resolve(serverRoot, '..', '..')
dotenv.config({ path: path.join(serverRoot, '.env') })

function sha256(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

async function main() {
  const manifestPath = path.join(workspaceRoot, 'assets', 'voice-packs', 'dreamchord-dialogue', 'manifest.json')
  const manifest = parseDialogueVoiceManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  const user = await prisma.user.findUnique({ where: { username: 'demo' } })
  if (!user) throw new Error('未找到 demo 用户，请先运行 pnpm db:seed')

  const configuredUploadRoot = process.env.UPLOAD_DIR || './uploads'
  const uploadRoot = path.isAbsolute(configuredUploadRoot) ? configuredUploadRoot : path.resolve(serverRoot, configuredUploadRoot)
  const relativeDirectory = path.join('library', user.id, 'dialogue-voices')
  const destinationDirectory = path.join(uploadRoot, relativeDirectory)
  mkdirSync(destinationDirectory, { recursive: true })

  const authorizationNote = `DreamChord 本地合成台词声线。基础模型 ${manifest.sourceModel}（${manifest.sourceLicense}），来源 ${manifest.sourceUrl}。采用模型预置 speaker 与表演指令生成，非真人声音克隆；台词为本项目原创示例文本。表演效果请试听确认。`

  const urlFor = (takeId: string) => `/uploads/${relativeDirectory}/${takeId}.wav`

  // Validate all files before touching the database.
  for (const take of manifest.takes) {
    const source = path.resolve(path.dirname(manifestPath), take.outputFile)
    if (!existsSync(source)) throw new Error(`缺少台词音频：${source}`)
    const actualHash = sha256(source)
    if (actualHash !== take.sha256) throw new Error(`${take.id} 的 SHA256 与清单不一致，拒绝导入`)
    copyFileSync(source, path.join(destinationDirectory, `${take.id}.wav`))
  }

  let importedTakes = 0
  for (const voice of manifest.voices) {
    const voiceTakes = manifest.takes.filter((take) => take.role === voice.id)
    const zhTakes = voiceTakes.filter((take) => take.language === 'zh')
    const jaTakes = voiceTakes.filter((take) => take.language === 'ja')
    if (zhTakes.length < 3 || jaTakes.length < 3) throw new Error(`${voice.name} 的双语台词样本不完整（需中文与日文各 3 条）`)
    const preview = zhTakes[0]
    const profileId = dialogueVoiceKeys(voice.id, preview.id).profileId

    const profileData = {
      ownerId: user.id,
      name: voice.name,
      description: `${voice.direction} 支持中文和日文；两种语言均使用同一基础声线，样音为原创示例台词。`,
      language: 'zh',
      ageTone: voice.ageTone,
      genderTone: voice.genderTone,
      tags: JSON.stringify(['台词配音', '中日双语', '合成音色']),
      provider: 'cosyvoice',
      status: 'active',
      previewUrl: urlFor(preview.id),
      authorizationNote,
    }
    await prisma.voiceProfile.upsert({
      where: { id: profileId },
      update: profileData,
      create: { id: profileId, ...profileData },
    })

    for (const take of voiceTakes) {
      const keys = dialogueVoiceKeys(voice.id, take.id)
      const provenance = {
        voiceSample: {
          consentConfirmed: true,
          consentBasis: `本地合成音频（${manifest.sourceModel}，${manifest.sourceLicense}），无真人来源`,
          transcript: take.text,
          language: take.language,
          style: `${take.emotion}·${take.scene}`,
          syntheticSource: true,
        },
        dialogueVoice: {
          packId: manifest.packId,
          voiceId: voice.id,
          speaker: take.speaker,
          instruction: take.instruction,
          sha256: take.sha256,
          durationSeconds: take.durationSeconds,
          sampleRate: take.sampleRate,
          syntheticSource: true,
        },
      }
      const assetData = {
        ownerId: user.id,
        name: `${voice.name} · ${take.language === 'zh' ? '中文' : '日文'}样音 · ${take.scene}`,
        type: 'VOICE_SAMPLE',
        url: urlFor(take.id),
        mimeType: 'audio/wav',
        metadata: JSON.stringify(provenance),
        status: 'ready',
      }
      await prisma.$transaction(async (tx) => {
        await tx.asset.upsert({ where: { id: keys.assetId }, update: assetData, create: { id: keys.assetId, ...assetData } })
        await tx.voiceReference.upsert({
          where: { id: keys.referenceId },
          update: { profileId: keys.profileId, assetId: keys.assetId, transcript: take.text, language: take.language, emotion: take.emotion, authorizationConfirmed: true, status: 'active' },
          create: { id: keys.referenceId, profileId: keys.profileId, assetId: keys.assetId, transcript: take.text, language: take.language, emotion: take.emotion, authorizationConfirmed: true, status: 'active' },
        })
      })
      importedTakes += 1
      console.log(`✓ ${voice.name} · ${take.language} · ${take.scene} (${take.durationSeconds.toFixed(1)}s)`)
    }
  }

  console.log(`台词声线同步完成：${manifest.voices.length} 个声线、${importedTakes} 条样音，可安全重复执行。`)
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(async () => prisma.$disconnect())
