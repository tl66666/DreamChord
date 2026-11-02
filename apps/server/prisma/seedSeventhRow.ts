import { createHash } from 'node:crypto'
import { readFile, mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { SEVENTH_ROW_DEMO } from '@dreamchord/story-domain'
import { seedSeventhRow } from '../src/demo/seventhRowSeed.js'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(serverRoot, '../..')
dotenv.config({ path: path.join(serverRoot, '.env') })
const client = new PrismaClient()
interface Take { id: string; role: string; nodeId: string; language: 'zh' | 'ja'; text: string; outputFile: string; sha256: string; durationSeconds: number }
async function main() {
  const owner = await client.user.findUniqueOrThrow({ where: { username: 'demo' } })
  const pack = path.join(root, 'assets/voice-packs/seventh-row')
  const manifest = JSON.parse(await readFile(path.join(pack, 'manifest.json'), 'utf8')) as { sourceModel: string; sourceUrl: string; voices: Array<{ id: string; name: string; role: string; direction: string; genderTone: string }>; takes: Take[] }
  const lines = SEVENTH_ROW_DEMO.graph.nodes.filter(n => n.type === 'dialogue' && n.data.role !== '旁白')
  for (const node of lines) for (const language of ['zh', 'ja'] as const) {
    const take = manifest.takes.find(t => t.id === `${node.id}-${language}`)
    const text = language === 'zh' ? node.data.text : (node.data.localizations as { ja: { text: string } }).ja.text
    if (!take || take.text !== text || !/^[a-z0-9-]+\.wav$/.test(take.outputFile)) throw new Error(`配音未完成：${node.id}-${language}`)
    if (createHash('sha256').update(await readFile(path.join(pack, take.outputFile))).digest('hex') !== take.sha256) throw new Error(`配音哈希不匹配：${take.id}`)
    await readFile(path.join(root, 'apps/web/public/assets/audio/seventh-row', `${take.id}.ogg`))
  }
  const project = await seedSeventhRow(client, owner.id)
  const credits = JSON.parse(await readFile(path.join(root, 'apps/web/public/assets/audio/seventh-row/music-credits.json'), 'utf8')) as Array<{ id: string; name: string; mood: string; scene: string; author: string; license: string; sourceUrl: string; sha256: string; durationSeconds: number }>
  for (const track of credits) await client.asset.upsert({ where: { id: `seventh-music-${track.id}` }, update: {}, create: { id: `seventh-music-${track.id}`, ownerId: owner.id, name: `第七排 · ${track.name}`, type: 'BGM', url: `/assets/audio/seventh-row/${track.id}.ogg`, mimeType: 'audio/ogg', metadata: JSON.stringify({ audioLibrary: { mood: track.mood, style: '视觉小说原声', scene: track.scene, loop: true, license: `${track.license} · ${track.author}`, source: track.sourceUrl }, durationSeconds: track.durationSeconds, sha256: track.sha256, generativeAiUsed: false }) } })
  const uploadRoot = path.resolve(serverRoot, process.env.UPLOAD_DIR || './uploads')
  const relative = `library/${owner.id}/seventh-row`
  await mkdir(path.join(uploadRoot, relative), { recursive: true })
  for (const voice of manifest.voices) {
    const description = ({ luyao: '温暖、平稳，句尾收得轻。适合有分寸的旧友、青年女性与安静的日常谈话。', chengxia: '清晰、率直，带轻微的明亮感。适合有主见的青年女性、朋友间的对话与坦白。', chenyu: '偏低的青年男声，自然克制，保留犹豫与停顿。适合第一人称男主、旧友重逢和内敛对白。' } as Record<string, string>)[voice.id]!
    const refs = ['zh', 'ja'].map(language => {
      const take = manifest.takes.find(t => t.role === voice.id && t.language === language && t.durationSeconds >= 3.5 && t.durationSeconds <= 9.5)
      if (!take) throw new Error(`${voice.name} 缺少 3.5–9.5 秒的 ${language} 参考。`)
      return take
    })
    for (const take of refs) await copyFile(path.join(pack, take.outputFile), path.join(uploadRoot, relative, `${take.id}.wav`))
    const url = (take: Take) => `/uploads/${relative}/${take.id}.wav`
    const profileId = `seventh-voice-${voice.id}`
    await client.voiceProfile.upsert({ where: { id: profileId }, update: {}, create: { id: profileId, ownerId: owner.id, name: voice.name, description, language: 'zh', ageTone: '青年', genderTone: voice.genderTone, provider: 'cosyvoice', previewUrl: url(refs[0]!), tags: JSON.stringify(['官方短篇', '中日双语', '自然对话', '合成音色']), authorizationNote: `Qwen3-TTS 预置合成音色，Apache-2.0。非真人克隆。${manifest.sourceUrl}` } })
    await client.voiceProfile.updateMany({ where: { id: profileId, ownerId: owner.id, description: `${voice.direction} 原创短篇《第七排，空座》角色音色，可用于中日对白。` }, data: { description } })
    await client.voiceProfile.updateMany({ where: { id: profileId, ownerId: owner.id, tags: JSON.stringify(['官方短篇', '中日双语', '自然对话', '合成音色']) }, data: { tags: JSON.stringify(['官方短篇', '第七排，空座', '中日双语', '自然对话', '合成音色']) } })
    for (const take of refs) {
      const assetId = `seventh-ref-${take.id}`
      await client.asset.upsert({ where: { id: assetId }, update: {}, create: { id: assetId, ownerId: owner.id, name: `${voice.name} · ${take.language}参考`, type: 'VOICE_SAMPLE', url: url(take), mimeType: 'audio/wav', metadata: JSON.stringify({ voiceSample: { consentConfirmed: true, transcript: take.text, language: take.language, syntheticSource: true }, sourceModel: manifest.sourceModel, sha256: take.sha256 }) } })
      await client.voiceReference.upsert({ where: { id: assetId }, update: {}, create: { id: assetId, profileId, assetId, transcript: take.text, language: take.language, authorizationConfirmed: true } })
    }
    const character = await client.character.findUnique({ where: { projectId_name: { projectId: project.id, name: voice.role } } })
    if (character) await client.characterVoiceBinding.upsert({ where: { characterId: character.id }, update: {}, create: { projectId: project.id, characterId: character.id, profileId } })
  }
  console.log(`${project.title}：完整 ${lines.length * 2} 条中日配音、3 位角色及音色。已存在的作品与绑定保留。`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => client.$disconnect())
