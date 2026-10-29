import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import { humanVoiceKeys, parseHumanVoiceManifest } from '../src/voice/humanVoiceManifest.js'

const prisma = new PrismaClient()
const prismaRoot = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(prismaRoot, '..')
const workspaceRoot = path.resolve(serverRoot, '..', '..')
dotenv.config({ path: path.join(serverRoot, '.env') })

function sha256(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

async function main() {
  const manifestPath = path.join(workspaceRoot, 'assets', 'voice-packs', 'dreamchord-human', 'manifest.json')
  const manifest = parseHumanVoiceManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  const user = await prisma.user.findUnique({ where: { username: 'demo' } })
  if (!user) throw new Error('未找到 demo 用户，请先运行 pnpm db:seed')

  const configuredUploadRoot = process.env.UPLOAD_DIR || './uploads'
  const uploadRoot = path.isAbsolute(configuredUploadRoot) ? configuredUploadRoot : path.resolve(serverRoot, configuredUploadRoot)
  const relativeDirectory = path.join('library', user.id, 'voice-human')
  const destinationDirectory = path.join(uploadRoot, relativeDirectory)
  mkdirSync(destinationDirectory, { recursive: true })

  const authorizationNote = `真人语音素材，来源 ${manifest.source.site}（${manifest.source.license}，署名『${manifest.source.attribution}』）；授权依据为 CC 许可证再分发条款，未获声音本人对 AI 声音克隆的单独同意，请勿用作声音克隆/TTS 训练参考，仅限直接播放使用。`

  function assetUrl(role: string) {
    return `/uploads/${path.join(relativeDirectory, `${role}.ogg`).replaceAll('\\', '/')}`
  }

  let importedClips = 0
  for (const profile of manifest.profiles) {
    const previewClip = profile.clips.find((clip) => clip.role === profile.previewClip)
    if (!previewClip) throw new Error(`${profile.name} 的 previewClip 无效`)

    await prisma.voiceProfile.upsert({
      where: { id: humanVoiceKeys(profile, previewClip).profileId },
      update: {
        ownerId: user.id, name: profile.name, description: profile.description, language: profile.language, ageTone: profile.ageTone,
        genderTone: profile.genderTone, tags: JSON.stringify(profile.tags), provider: 'human-sample', status: 'active',
        previewUrl: assetUrl(previewClip.role),
        authorizationNote,
      },
      create: {
        id: humanVoiceKeys(profile, previewClip).profileId, ownerId: user.id, name: profile.name, description: profile.description, language: profile.language,
        ageTone: profile.ageTone, genderTone: profile.genderTone, tags: JSON.stringify(profile.tags), provider: 'human-sample', status: 'active',
        previewUrl: assetUrl(previewClip.role),
        authorizationNote,
      },
    })

    for (const clip of profile.clips) {
      const source = path.resolve(path.dirname(manifestPath), clip.outputFile)
      if (!existsSync(source)) throw new Error(`缺少真人语音样本：${source}`)
      const actualHash = sha256(source)
      if (actualHash !== clip.sha256) throw new Error(`${clip.name} 的 SHA256 与清单不一致，拒绝导入`)

      const filename = `${clip.role}.ogg`
      const destination = path.join(destinationDirectory, filename)
      copyFileSync(source, destination)
      const url = assetUrl(clip.role)
      const keys = humanVoiceKeys(profile, clip)
      const provenance = {
        humanVoice: {
          packId: manifest.packId,
          profileId: profile.id,
          clipRole: clip.role,
          site: manifest.source.site,
          license: manifest.source.license,
          attribution: manifest.source.attribution,
          sourceUrl: manifest.source.sourceUrl,
          sha256: clip.sha256,
          durationSeconds: clip.durationSeconds,
          syntheticSource: false,
        },
        voiceSample: {
          consentConfirmed: true,
          consentBasis: 'CC BY 4.0 许可证再分发授权（OtoLogic）',
          transcript: clip.transcript,
          language: profile.language,
          style: profile.tags.join('、'),
          syntheticSource: false,
        },
      }

      await prisma.$transaction(async (tx) => {
        await tx.asset.upsert({
          where: { id: keys.assetId },
          update: { ownerId: user.id, name: `${profile.name} · ${clip.name}`, type: 'VOICE_SAMPLE', url, mimeType: 'audio/ogg', metadata: JSON.stringify(provenance), status: 'ready' },
          create: { id: keys.assetId, ownerId: user.id, name: `${profile.name} · ${clip.name}`, type: 'VOICE_SAMPLE', url, mimeType: 'audio/ogg', metadata: JSON.stringify(provenance), status: 'ready' },
        })
        await tx.voiceReference.upsert({
          where: { id: keys.referenceId },
          update: { profileId: keys.profileId, assetId: keys.assetId, transcript: clip.transcript, language: profile.language, emotion: clip.emotion, authorizationConfirmed: true, status: 'active' },
          create: { id: keys.referenceId, profileId: keys.profileId, assetId: keys.assetId, transcript: clip.transcript, language: profile.language, emotion: clip.emotion, authorizationConfirmed: true, status: 'active' },
        })
      })
      importedClips += 1
      console.log(`✓ ${profile.name} · ${clip.name} (${clip.durationSeconds.toFixed(1)}s)`)
    }
  }

  console.log(`真人声线同步完成：${manifest.profiles.length} 个声线、${importedClips} 条样本，可安全重复执行。`)
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(async () => prisma.$disconnect())
