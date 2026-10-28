import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { OFFICIAL_DEMO, voiceTextHash } from '@dreamchord/story-domain'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(serverRoot, '../..')
dotenv.config({ path: path.join(serverRoot, '.env') })
const prisma = new PrismaClient()
interface Take { id: string; role: string; speaker: string; nodeId: string; language: 'zh' | 'ja'; text: string; isReference: boolean; outputFile: string; sha256: string; durationSeconds: number }
interface CastVoice { id: string; name: string; genderTone: string; ageTone: string; direction: string }
async function main() {
  const pack = path.join(root, 'assets/voice-packs/dreamchord-cast')
  const manifest = JSON.parse(await readFile(path.join(pack, 'manifest.json'), 'utf8')) as { sourceModel: string; sourceUrl: string; sourceLicense: string; syntheticSource: boolean; voices: CastVoice[]; takes: Take[] }
  if (manifest.sourceModel !== 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice' || manifest.sourceLicense !== 'Apache-2.0' || !manifest.syntheticSource) throw new Error('音色来源清单无效。')
  const owner = await prisma.user.findUnique({ where: { username: 'demo' } })
  if (!owner) throw new Error('demo 账号不存在。')
  const project = await prisma.project.findFirst({ where: { id: OFFICIAL_DEMO.id, authorId: owner.id }, include: { characters: true, chapters: { include: { nodes: true } } } })
  if (!project) throw new Error('官方示例不存在。')
  const roleNames: Record<string, string> = { yuki: '雪', ren: '影', miya: '宫', sora: '空', ghost: '系统幽灵' }
  const relative = `library/${owner.id}/bilingual-cast`
  const uploadRoot = path.resolve(serverRoot, process.env.UPLOAD_DIR || './uploads')
  await mkdir(path.join(uploadRoot, relative), { recursive: true })
  // Validate all files before touching the database.
  for (const take of manifest.takes) {
    if (!/^generated\/[a-z0-9-]+\.wav$/.test(take.outputFile)) throw new Error('音频路径无效。')
    const bytes = await readFile(path.join(pack, take.outputFile))
    if (createHash('sha256').update(bytes).digest('hex') !== take.sha256) throw new Error(`${take.id} 哈希不一致。`)
    await copyFile(path.join(pack, take.outputFile), path.join(uploadRoot, relative, `${take.id}.wav`))
  }
  const urlFor = (take: Take) => `/uploads/${relative}/${take.id}.wav`
  let applied = 0
  await prisma.$transaction(async (tx) => {
    for (const voice of manifest.voices) {
      const refs = manifest.takes.filter((take) => take.role === voice.id && take.isReference)
      if (refs.length !== 2 || !refs.some((take) => take.language === 'zh') || !refs.some((take) => take.language === 'ja')) throw new Error(`${voice.name} 的双语样本不完整。`)
      const profileId = `cast-voice-${voice.id}`
      const profileData = { ownerId: owner.id, name: voice.name, description: `${voice.direction} 支持中文和日文；两种语言均使用同一基础声线。`, language: 'zh', genderTone: voice.genderTone, ageTone: voice.ageTone, tags: JSON.stringify(['官方角色', '中日双语', '合成音色']), provider: 'cosyvoice', previewUrl: urlFor(refs.find((take) => take.language === 'zh')!), authorizationNote: `DreamChord 示例合成角色声线。基础模型 ${manifest.sourceModel}（${manifest.sourceLicense}），${manifest.sourceUrl}。采用模型预置 speaker，非真人克隆；表演效果请试听确认。` }
      await tx.voiceProfile.upsert({ where: { id: profileId }, create: { id: profileId, ...profileData }, update: {} })
      for (const take of refs) {
        const assetId = `cast-reference-asset-${take.id}`
        const data = { ownerId: owner.id, name: `${voice.name} · ${take.language === 'zh' ? '中文' : '日文'}参考`, type: 'VOICE_SAMPLE', url: urlFor(take), mimeType: 'audio/wav', metadata: JSON.stringify({ voiceSample: { consentConfirmed: true, transcript: take.text, language: take.language, syntheticSource: true }, sourceModel: manifest.sourceModel, sha256: take.sha256, durationSeconds: take.durationSeconds }) }
        await tx.asset.upsert({ where: { id: assetId }, create: { id: assetId, ...data }, update: {} })
        await tx.voiceReference.upsert({ where: { id: `cast-reference-${take.id}` }, create: { id: `cast-reference-${take.id}`, profileId, assetId, transcript: take.text, language: take.language, emotion: '自然', authorizationConfirmed: true }, update: {} })
      }
      const character = project.characters.find((item) => item.name === roleNames[voice.id])
      if (character) {
        const binding = await tx.characterVoiceBinding.findUnique({ where: { characterId: character.id } })
        if (!binding || binding.profileId.startsWith('starter-voice-profile-')) await tx.characterVoiceBinding.upsert({ where: { characterId: character.id }, create: { projectId: project.id, characterId: character.id, profileId }, update: { profileId } })
      }
    }
    for (const chapter of project.chapters) {
      let changed = false
      for (const stored of chapter.nodes) {
        const data = JSON.parse(stored.data) as Record<string, unknown>
        const tracks = { ...(data.voiceTracks as Record<string, unknown> || {}) }
        for (const take of manifest.takes.filter((item) => item.nodeId === stored.nodeId)) {
          const translations = data.localizations as { ja?: { text?: string } } | undefined
          const text = take.language === 'zh' ? data.text : translations?.ja?.text
          const existing = tracks[take.language] as { url?: string; profileId?: string } | undefined
          if (text === take.text && existing?.url === urlFor(take) && !existing.profileId) { tracks[take.language] = { ...existing, profileId: `cast-voice-${take.role}` }; changed = true }
          if (text !== take.text || tracks[take.language]) continue
          const assetId = `cast-line-${take.id}`
          const asset = { ownerId: owner.id, projectId: project.id, name: `${roleNames[take.role]} · ${take.language} · ${take.text.slice(0, 16)}`, type: 'VOICE', url: urlFor(take), mimeType: 'audio/wav', metadata: JSON.stringify({ voiceGeneration: { text: take.text, language: take.language, textHash: voiceTextHash(take.text), sourceModel: manifest.sourceModel, syntheticSource: true, speaker: take.speaker, profileId: `cast-voice-${take.role}`, sha256: take.sha256 } }) }
          await tx.asset.upsert({ where: { id: assetId }, create: { id: assetId, ...asset }, update: {} })
          tracks[take.language] = { url: urlFor(take), textHash: voiceTextHash(take.text), profileId: `cast-voice-${take.role}` }
          applied++; changed = true
        }
        if (Object.keys(tracks).length) await tx.flowNode.update({ where: { id: stored.id }, data: { data: JSON.stringify({ ...data, voiceTracks: tracks }) } })
      }
      if (changed) await tx.chapter.update({ where: { id: chapter.id }, data: { version: { increment: 1 } } })
    }
  }, { timeout: 30000 })
  console.log(`双语角色库：${manifest.voices.length} 个音色、${manifest.takes.length} 条音频；本次应用 ${applied} 条语言轨。已有自定义配音和绑定保留。`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
