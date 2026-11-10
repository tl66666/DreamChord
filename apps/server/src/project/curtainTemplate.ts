import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Prisma, PrismaClient } from '@prisma/client'
import { CURTAIN_CALL_DEMO, CURTAIN_STARTER_ENDING, type StoryNode, type StoryEdge } from '@dreamchord/story-domain'
import { prisma } from '../lib/prisma.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
export const curtainPackRoot = path.join(root, 'assets/voice-packs/curtain-call')
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
const scoped = (scope: string, key: string) => `curtain-${hash(`${scope}\0${key}`).slice(0, 32)}`
type Voice = { id: string; role: string; name: string; description: string; genderTone: string }
type Reference = { id: string; role: string; language: string; text: string; outputFile: string; sha256: string; durationSeconds: number; url: string }
export interface CurtainCast { voices: Voice[]; references: Reference[] }

/** Only a fixed server-owned pack is accepted. Public project data never supplies file paths. */
export async function prepareCurtainCast(ownerId: string, scope: string, storageRoot: string, packRoot = curtainPackRoot): Promise<CurtainCast> {
  const manifest = JSON.parse(await readFile(path.join(packRoot, 'manifest.json'), 'utf8')) as CurtainCast
  const directory = `templates/curtain-call/${hash(`${ownerId}\0${scope}`).slice(0, 32)}`
  const targetRoot = path.join(storageRoot, directory)
  await mkdir(targetRoot, { recursive: true })
  const references: Reference[] = []
  for (const character of CURTAIN_CALL_DEMO.characters) {
    const voice = manifest.voices.find(v => v.id === character.slug && v.role === character.name)
    if (!voice) throw new Error('官方模板音色包不完整，请联系维护者。')
    for (const language of ['zh', 'ja']) {
      const ref = manifest.references.find(r => r.role === voice.id && r.language === language)
      if (!ref || ref.outputFile !== `ref-${voice.id}-${language}.wav` || !/^[a-f0-9]{64}$/.test(ref.sha256) || ref.durationSeconds < 3 || ref.durationSeconds > 10) throw new Error('官方模板缺少可用的双语参考音频。')
      const bytes = await readFile(path.join(packRoot, ref.outputFile))
      if (hash(bytes) !== ref.sha256) throw new Error('官方音色文件校验失败。')
      const target = path.join(targetRoot, ref.outputFile)
      try { await writeFile(target, bytes, { flag: 'wx' }) }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || hash(await readFile(target)) !== ref.sha256) throw error
      }
      references.push({ ...ref, url: `/uploads/${directory}/${ref.outputFile}` })
    }
  }
  return { voices: manifest.voices, references }
}

/** Profiles and references belong to the new author, so future edited dialogue can use them. */
export async function installCurtainCast(tx: Prisma.TransactionClient, ownerId: string, scope: string, cast: CurtainCast, official = false) {
  const profiles = new Map<string, string>()
  for (const character of CURTAIN_CALL_DEMO.characters) {
    const voice = cast.voices.find(v => v.id === character.slug)!
    const profileId = official ? `curtain-voice-${voice.id}` : scoped(scope, `voice-${voice.id}`)
    profiles.set(voice.id, profileId)
    await tx.voiceProfile.upsert({ where: { id: profileId }, update: {}, create: {
      id: profileId, ownerId, name: voice.name, description: voice.description, language: 'zh', ageTone: '青年', genderTone: voice.genderTone,
      provider: 'gpt-sovits', tags: JSON.stringify([official ? '官方短篇' : '示例副本', '明日列车与未完的谢幕', '中日双语', '自然对话', '合成音色']),
      previewUrl: cast.references.find(r => r.role === voice.id && r.language === 'zh')!.url,
      authorizationNote: '原创角色；Qwen3-TTS CustomVoice 预置合成参考音色（Apache-2.0），GPT-SoVITS 生成对白。非真人克隆，未使用商业游戏演员录音。',
    } })
    for (const ref of cast.references.filter(r => r.role === voice.id)) {
      const assetId = scoped(scope, `reference-${ref.id}`)
      await tx.asset.upsert({ where: { id: assetId }, update: {}, create: { id: assetId, ownerId, name: `${voice.name} · ${ref.language}参考`, type: 'VOICE_SAMPLE', url: ref.url, mimeType: 'audio/wav', metadata: JSON.stringify({ voiceSample: { consentConfirmed: true, transcript: ref.text, language: ref.language, syntheticSource: true }, sourceModel: 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', sourceLicense: 'Apache-2.0', sha256: ref.sha256 }) } })
      await tx.voiceReference.upsert({ where: { id: assetId }, update: {}, create: { id: assetId, assetId, profileId, transcript: ref.text, language: ref.language, authorizationConfirmed: true } })
    }
  }
  return profiles
}

export interface CurtainTemplateEntry { id: string; title: string; focusSceneId: string; focusNodeId: string }
export async function createCurtainTemplate(ownerId: string, requestId: string, options: { client?: PrismaClient; packRoot?: string; storageRoot?: string } = {}): Promise<CurtainTemplateEntry> {
  const client = options.client || prisma
  const projectId = scoped(ownerId, requestId)
  const focusSceneId = scoped(projectId, 'your-ending')
  const focusNodeId = scoped(projectId, CURTAIN_STARTER_ENDING.id)
  const entry = { id: projectId, title: '我的第三种结局 · 明日列车与未完的谢幕', focusSceneId, focusNodeId }
  const existing = await client.project.findUnique({ where: { id: projectId } })
  if (existing) {
    if (existing.authorId !== ownerId) throw new Error('模板副本归属异常。')
    return { ...entry, title: existing.title }
  }
  const cast = await prepareCurtainCast(ownerId, projectId, options.storageRoot || process.env.UPLOAD_DIR || './uploads', options.packRoot)
  try {
    return await client.$transaction(async tx => {
      const raced = await tx.project.findUnique({ where: { id: projectId } })
      if (raced) return { ...entry, title: raced.title }
      const profiles = await installCurtainCast(tx, ownerId, projectId, cast)
      const nodeId = (id: string) => scoped(projectId, id)
      const characterId = new Map(CURTAIN_CALL_DEMO.characters.map(c => [c.name, scoped(projectId, `character-${c.slug}`)]))
      const nodes: StoryNode[] = structuredClone(CURTAIN_CALL_DEMO.graph.nodes)
      const edges: StoryEdge[] = structuredClone(CURTAIN_CALL_DEMO.graph.edges)
      const choice = nodes.find(n => n.type === 'choice')!
      ;(choice.data.choices as string[]).push('写下我自己的谢幕词')
      ;(choice.data.localizations as { ja: { choices: string[] } }).ja.choices.push('自分の閉会の言葉を書く')
      const sceneData = { sceneGroupId: 'your-ending', sceneTitle: '我的第三种结局', sceneCode: '1-6' }
      nodes.push(
        { id: 'your-background', type: 'background', position: { x: 2880, y: 0 }, data: { backgroundId: `${'/assets/curtain-call'}/backstage.webp`, ...sceneData, audio: { bgm: { action: 'play', url: '/assets/audio/curtain-call/backstage.ogg', volume: .18, fadeInMs: 1000 } } } },
        { id: 'your-character', type: 'character', position: { x: 2880, y: 95 }, data: { characterId: '许栀', expression: 'smile', position: 'center', action: 'show', ...sceneData } },
        { ...structuredClone(CURTAIN_STARTER_ENDING), data: { ...structuredClone(CURTAIN_STARTER_ENDING.data), ...sceneData }, position: { x: 2880, y: 190 } },
      )
      edges.push({ id: 'choose-your-ending', source: choice.id, target: 'your-background', sourceHandle: 'choice-2', label: '我的第三种结局', animated: true }, { id: 'your-bg-character', source: 'your-background', target: 'your-character', animated: true }, { id: 'your-character-text', source: 'your-character', target: CURTAIN_STARTER_ENDING.id, animated: true })
      for (const node of nodes) {
        node.id = nodeId(node.id)
        node.data.sceneGroupId = scoped(projectId, String(node.data.sceneGroupId))
        if (typeof node.data.characterId === 'string') node.data.characterId = characterId.get(node.data.characterId as '许栀') || node.data.characterId
        const tracks = node.data.voiceTracks as Record<string, { profileId: string }> | undefined
        if (tracks) for (const track of Object.values(tracks)) track.profileId = profiles.get(track.profileId.replace('curtain-voice-', ''))!
      }
      await tx.project.create({ data: {
        id: projectId, authorId: ownerId, title: entry.title, description: '从官方短篇继续：选择「我的第三种结局」，改写许栀面前的那一句。角色、音色与场景已准备好。', cover: CURTAIN_CALL_DEMO.cover,
        defaultSubtitleLocale: 'zh', defaultVoiceLocale: 'ja', isPublic: false, isPublished: false,
        assets: { create: [
          { id: 'backstage', name: '谢幕之前 · 排练与拌嘴', mood: '日常' }, { id: 'unsaid', name: '没说出口 · 上台前一分钟', mood: '忧郁' },
          { id: 'invitation', name: '下一次见面 · 夏夜约定', mood: '温柔' }, { id: 'station', name: '话还没说完 · 清晨送行', mood: '治愈' },
        ].map(t => ({ ownerId, name: t.name, type: 'BGM', url: `/assets/audio/curtain-call/${t.id}.ogg`, mimeType: 'audio/ogg', metadata: JSON.stringify({ audioLibrary: { mood: t.mood, style: '视觉小说原声', scene: '明日列车与未完的谢幕', loop: true, license: 'CC0-1.0 · TERNOX', source: 'https://ternox.itch.io/vn-music' }, generativeAiUsed: false }) })) },
        characters: { create: CURTAIN_CALL_DEMO.characters.map(({ slug, ...c }) => ({ ...c, id: characterId.get(c.name), sprites: { create: ['normal', 'sad', 'smile'].map(expression => ({ name: expression, url: `/assets/curtain-call/${slug}-${expression}.png` })) } })) },
        chapters: { create: { title: CURTAIN_CALL_DEMO.chapterTitle, order: 0, nodes: { create: nodes.map(n => ({ nodeId: n.id, type: n.type, positionX: n.position.x, positionY: n.position.y, data: JSON.stringify(n.data) })) }, edges: { create: edges.map(e => ({ edgeId: nodeId(e.id), source: nodeId(e.source), target: nodeId(e.target), sourceHandle: e.sourceHandle, label: e.label, animated: e.animated })) } } },
      } })
      for (const c of CURTAIN_CALL_DEMO.characters) await tx.characterVoiceBinding.create({ data: { projectId, characterId: characterId.get(c.name)!, profileId: profiles.get(c.slug)! } })
      return entry
    }, { timeout: 15000 })
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error
    const won = await client.project.findUnique({ where: { id: projectId } })
    if (!won || won.authorId !== ownerId) throw error
    return { ...entry, title: won.title }
  }
}
