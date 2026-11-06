import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Prisma, PrismaClient } from '@prisma/client'
import { PAINT_PROLOGUE, PAINT_STARTER_CARD } from '@dreamchord/story-domain'
import type { StoryGraph, StoryNode } from '@dreamchord/story-domain'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const scoped = (scope: string, key: string) => `paint-${hash(`${scope}\0${key}`).slice(0, 32)}`
// Source is always the bundled script, never a caller-supplied project.
const builtin = () => PAINT_PROLOGUE
const starterCard = () => PAINT_STARTER_CARD
const starterScene = { sceneGroupId: 'your-next-scene', sceneTitle: '我的下一句', sceneCode: '1-5' }
const starterStage: StoryNode[] = [
  { id: 'your-next-background', type: 'background', position: { x: 2400, y: 0 }, data: { backgroundId: '/assets/paint-prologue/night.webp', ...starterScene } },
  { id: 'your-next-character', type: 'character', position: { x: 2400, y: 110 }, data: { characterId: '夏禾', expression: 'normal', position: 'center', action: 'show', ...starterScene } },
]
export interface PaintOptions { client?: PrismaClient; packRoot?: string; publicRoot?: string; storageRoot?: string }
export interface PaintDefinition { id: string; title: string; description: string; cover: string; chapterTitle: string; characters: readonly { slug: string; name: string; description: string; color: string; defaultSprite: string }[]; graph: StoryGraph }
export interface PaintTemplateEntry { id: string; title: string; focusNodeId: string; focusSceneId: string }
export class DeletedPaintTemplateRequestError extends Error {
  readonly code = 'TEMPLATE_COPY_DELETED'
  constructor() { super('这个续写副本已删除，请使用新的创建请求。') }
}
const voiceSchema = z.object({ id: z.string(), role: z.string(), name: z.string(), description: z.string(), genderTone: z.string() })
const referenceSchema = z.object({ id: z.string(), role: z.string(), language: z.literal('ja'), text: z.string().min(1), outputFile: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), durationSeconds: z.number().min(3).max(10), emotion: z.string().optional(), sourceModel: z.string().optional(), license: z.string().optional(), source: z.string().optional() })
const takeSchema = z.object({ runtimeFile: z.string().optional(), runtimeSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), referenceId: z.string().optional(), purpose: z.string().optional() }).passthrough()
const manifestSchema = z.object({ voices: z.array(voiceSchema), references: z.array(referenceSchema), takes: z.array(takeSchema) })
type PreparedReference = z.infer<typeof referenceSchema> & { bytes: Buffer; url: string }
interface PreparedPaint { voices: z.infer<typeof voiceSchema>[]; references: PreparedReference[]; takeReferences: Map<string, string>; music: { url: string; metadata: string; name: string }[] }

function publicPath(publicRoot: string, url: string) {
  if (!/^\/assets\/[a-zA-Z0-9_./-]+$/.test(url) || url.split('/').some(part => part === '..' || part === '.')) throw new Error('官方媒体路径无效。')
  const file = path.resolve(publicRoot, `.${url}`)
  if (!file.startsWith(path.resolve(publicRoot) + path.sep)) throw new Error('官方媒体路径越界。')
  return file
}
function urlsIn(value: unknown): string[] {
  if (typeof value === 'string') return value.startsWith('/assets/') ? [value] : []
  if (Array.isArray(value)) return value.flatMap(urlsIn)
  return value && typeof value === 'object' ? Object.values(value).flatMap(urlsIn) : []
}
function takeUrl(value: string) {
  const normalized = value.replaceAll('\\', '/')
  return normalized.startsWith('apps/web/public/assets/') ? normalized.slice('apps/web/public'.length) : normalized.startsWith('assets/') ? `/${normalized}` : normalized
}

/** Validate every required source before copying files or writing database rows. */
async function preparePaint(ownerId: string, projectId: string, options: PaintOptions, official: boolean, definition: PaintDefinition = builtin(), copyReferences = true): Promise<PreparedPaint> {
  const sourceNodes = official ? definition.graph.nodes : [...definition.graph.nodes, ...starterStage, starterCard()]
  const packRoot = options.packRoot || path.join(root, 'assets/voice-packs/paint-prologue')
  const publicRoot = options.publicRoot || path.join(root, 'apps/web/public')
  const manifest = manifestSchema.parse(JSON.parse(await readFile(path.join(packRoot, 'manifest.json'), 'utf8')))
  const directory = `templates/paint-prologue/${hash(`${ownerId}\0${projectId}`).slice(0, 32)}`
  const references: PreparedReference[] = []
  const referenceIds = new Set<string>()
  const referenceFiles = new Set<string>()
  for (const character of definition.characters) {
    const voices = manifest.voices.filter(v => v.id === character.slug && v.role === character.name)
    const refs = manifest.references.filter(r => r.role === character.slug && r.language === 'ja')
    if (voices.length !== 1 || !refs.length) throw new Error('官方序章缺少角色日语音色参考。')
    for (const ref of refs) {
      if (!/^[a-zA-Z0-9_-]+\.wav$/.test(ref.outputFile) || referenceIds.has(ref.id) || referenceFiles.has(ref.outputFile)) throw new Error('官方音色参考文件路径或标识无效。')
      referenceIds.add(ref.id); referenceFiles.add(ref.outputFile)
      const bytes = await readFile(path.join(packRoot, ref.outputFile))
      if (hash(bytes) !== ref.sha256) throw new Error('官方音色参考校验失败。')
      references.push({ ...ref, bytes, url: `/uploads/${directory}/${ref.outputFile}` })
    }
  }
  const urls = new Set(urlsIn([definition.cover, sourceNodes, definition.characters.map(c => c.defaultSprite)]))
  for (const c of definition.characters.filter(c => c.slug !== 'lu')) for (const expression of ['normal', 'smile', 'serious']) urls.add(`/assets/paint-prologue/${c.slug}-${expression}.png`)
  for (const url of urls) if (!(await readFile(publicPath(publicRoot, url))).length) throw new Error(`官方媒体为空：${url}`)
  const takeReferences = new Map<string, string>()
  for (const node of sourceNodes.filter(n => n.type === 'dialogue')) {
    const tracks = node.data.voiceTracks as Record<string, { url?: string }> | undefined
    const url = tracks?.ja?.url
    if (!url) throw new Error(`官方日语对白未就绪：${node.id}`)
    const takes = manifest.takes.filter(t => t.purpose !== 'audition' && t.runtimeFile && takeUrl(t.runtimeFile) === url)
    if (takes.length !== 1 || hash(await readFile(publicPath(publicRoot, url))) !== takes[0].runtimeSha256) throw new Error(`官方日语音轨校验失败：${node.id}`)
    const character = definition.characters.find(c => c.name === node.data.role || c.slug === node.data.role)
    const localizations = node.data.localizations as { ja?: { text?: unknown } } | undefined
    const text = localizations?.ja?.text
    if (!character || typeof text !== 'string' || takes[0].text !== text || takes[0].nodeId !== node.id || takes[0].role !== character.slug || takes[0].language !== 'ja') throw new Error(`官方日语台词与音轨信息不一致，请重新生成：${node.id}`)
    const reference = references.find(r => r.role === character?.slug && (takes[0].referenceId ? r.id === takes[0].referenceId : true))
    if (!reference) throw new Error(`官方日语音轨参考无效：${node.id}`)
    takeReferences.set(url, reference.id)
  }
  const musicUrls = new Set(sourceNodes.flatMap(n => {
    const audio = n.data.audio as { bgm?: { url?: string } } | undefined
    return audio?.bgm?.url ? [audio.bgm.url] : []
  }))
  type Credit = { runtimeFile?: string; runtimeSha256?: string; id?: string; name?: string; author?: string; license?: string; sourceUrl?: string; durationSeconds?: number }
  const credits: Credit[] = []
  for (const directory of ['paint-prologue', 'paint-book']) {
    try { credits.push(...JSON.parse(await readFile(path.join(publicRoot, `assets/audio/${directory}/music-credits.json`), 'utf8')) as Credit[]) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  const music = []
  for (const url of musicUrls) {
    const credit = credits.find(c => c.runtimeFile && takeUrl(c.runtimeFile) === url)
    if (!credit?.runtimeSha256 || !credit.license || !credit.author || !credit.sourceUrl || hash(await readFile(publicPath(publicRoot, url))) !== credit.runtimeSha256) throw new Error(`官方配乐署名或校验不完整：${url}`)
    music.push({ url, name: credit.name || credit.id || '序章配乐', metadata: JSON.stringify({ audioLibrary: { license: `${credit.license} · ${credit.author}`, source: credit.sourceUrl, scene: definition.title, loop: true }, musicCredit: credit, sha256: credit.runtimeSha256, durationSeconds: credit.durationSeconds, generativeAiUsed: false }) })
  }
  const storageRoot = options.storageRoot || process.env.UPLOAD_DIR || './uploads'
  for (const ref of copyReferences ? references : []) {
    const target = path.join(storageRoot, ref.url.slice('/uploads/'.length))
    await mkdir(path.dirname(target), { recursive: true })
    try { await writeFile(target, ref.bytes, { flag: 'wx' }) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || hash(await readFile(target)) !== ref.sha256) throw error }
  }
  return { voices: manifest.voices, references, takeReferences, music }
}

/** Read-only full media verification for an explicit official release upgrade. */
export async function preflightPaintDefinition(definition: PaintDefinition, options: PaintOptions = {}) {
  return preparePaint('', definition.id, options, true, definition, false)
}

async function installProject(tx: Prisma.TransactionClient, ownerId: string, projectId: string, prepared: PreparedPaint, official: boolean) {
  const definition = builtin()
  const nodeId = (id: string) => official ? id : scoped(projectId, `node-${id}`)
  const sceneId = (id: string) => official ? id : scoped(projectId, `scene-${id}`)
  const characterIds = new Map<string, string>(definition.characters.flatMap(c => [[c.slug, scoped(projectId, `character-${c.slug}`)], [c.name, scoped(projectId, `character-${c.slug}`)]]))
  const profiles = new Map<string, string>(), references = new Map<string, string>()
  for (const c of definition.characters) {
    const voice = prepared.voices.find(v => v.id === c.slug)!, ref = prepared.references.find(r => r.role === c.slug)!
    const profileId = official ? `paint-voice-${c.slug}` : scoped(projectId, `voice-${c.slug}`)
    profiles.set(c.slug, profileId)
    await tx.voiceProfile.create({ data: { id: profileId, ownerId, name: voice.name, description: voice.description, language: 'ja', ageTone: '青年', genderTone: voice.genderTone, provider: 'gpt-sovits', previewUrl: ref.url, tags: JSON.stringify(['请让这幅画老去', '日语', '合成音色']), authorizationNote: '原创角色的合成参考音色；来源与制作记录见官方 paint-prologue 音色包。' } })
    for (const reference of prepared.references.filter(r => r.role === c.slug)) {
      const refId = scoped(projectId, `reference-${reference.id}`)
      references.set(reference.id, refId)
      await tx.asset.create({ data: { id: refId, ownerId, name: `${voice.name} · ${reference.emotion || '自然'}日语参考`, type: 'VOICE_SAMPLE', url: reference.url, mimeType: 'audio/wav', metadata: JSON.stringify({ voiceSample: { consentConfirmed: true, transcript: reference.text, language: 'ja', syntheticSource: true }, sha256: reference.sha256, sourceModel: reference.sourceModel, sourceLicense: reference.license, source: reference.source }) } })
      await tx.voiceReference.create({ data: { id: refId, profileId, assetId: refId, transcript: reference.text, language: 'ja', emotion: reference.emotion || '自然', authorizationConfirmed: true } })
    }
  }
  const nodes = structuredClone(definition.graph.nodes), edges = structuredClone(definition.graph.edges)
  if (!official) {
    const terminal = nodes.filter(n => !edges.some(e => e.source === n.id))
    if (terminal.length !== 1) throw new Error('官方序章结尾不唯一。')
    const starter = structuredClone(starterCard())
    starter.data = { ...starter.data, ...starterScene, creatorStarter: true }
    starter.position = { x: 2400, y: 220 }
    nodes.push(...structuredClone(starterStage), starter)
    edges.push(
      { id: 'continue-your-next-scene', source: terminal[0].id, target: starterStage[0].id, animated: true },
      { id: 'your-next-stage-character', source: starterStage[0].id, target: starterStage[1].id, animated: true },
      { id: 'your-next-stage-dialogue', source: starterStage[1].id, target: starter.id, animated: true },
    )
  }
  for (const node of nodes) {
    node.id = nodeId(node.id)
    if (typeof node.data.sceneGroupId === 'string') node.data.sceneGroupId = sceneId(node.data.sceneGroupId)
    if (typeof node.data.characterId === 'string') {
      const id = characterIds.get(node.data.characterId)
      if (!id) throw new Error('官方角色引用无效。')
      node.data.characterId = id
    }
    if (typeof node.data.targetNodeId === 'string') node.data.targetNodeId = nodeId(node.data.targetNodeId)
    const tracks = node.data.voiceTracks as Record<string, { url?: string; profileId?: string; referenceId?: string }> | undefined
    if (tracks) {
      const c = definition.characters.find(c => c.name === node.data.role || c.slug === node.data.role)
      if (!c) throw new Error('官方配音角色无效。')
      for (const track of Object.values(tracks)) {
        track.profileId = profiles.get(c.slug)!
        track.referenceId = references.get(prepared.takeReferences.get(track.url || '')!)!
      }
    }
  }
  const project = await tx.project.create({ data: {
    id: projectId, authorId: ownerId, title: official ? definition.title : `我的下一句 · ${definition.title}`, description: definition.description, cover: definition.cover,
    isPublic: official, isPublished: official, defaultSubtitleLocale: 'zh', defaultVoiceLocale: 'ja',
    assets: { create: prepared.music.map(m => ({ ownerId, name: m.name, type: 'BGM', url: m.url, mimeType: 'audio/ogg', metadata: m.metadata })) },
    characters: { create: definition.characters.map(({ slug, ...c }) => ({ ...c, id: characterIds.get(slug)!, sprites: { create: (slug === 'lu' ? ['normal'] : ['normal', 'smile', 'serious']).map(expression => ({ name: expression, url: `/assets/paint-prologue/${slug}-${expression}.png` })) } })) },
    chapters: { create: { title: definition.chapterTitle, order: 0, nodes: { create: nodes.map(n => ({ nodeId: n.id, type: n.type, positionX: n.position.x, positionY: n.position.y, data: JSON.stringify(n.data) })) }, edges: { create: edges.map(e => ({ edgeId: official ? e.id : scoped(projectId, `edge-${e.id}`), source: nodeId(e.source), target: nodeId(e.target), sourceHandle: e.sourceHandle, label: e.label, animated: e.animated })) } } },
  } })
  for (const c of definition.characters) await tx.characterVoiceBinding.create({ data: { projectId, characterId: characterIds.get(c.slug)!, profileId: profiles.get(c.slug)! } })
  return project
}

/** Returns an existing project verbatim; never upgrades or rewrites author data. */
export async function installPaintPrologue(client: PrismaClient, ownerId: string, projectId: string, official: boolean, options: PaintOptions = {}) {
  const exists = await client.project.findUnique({ where: { id: projectId } })
  if (exists) {
    if (!official && exists.authorId !== ownerId) throw new Error('模板副本归属异常。')
    return exists
  }
  if (!official) {
    const retained = await client.voiceProfile.findFirst({ where: { ownerId, id: { in: builtin().characters.map(c => scoped(projectId, `voice-${c.slug}`)) } }, select: { id: true } })
    if (retained) {
      const raced = await client.project.findUnique({ where: { id: projectId } })
      if (raced?.authorId === ownerId) return raced
      throw new DeletedPaintTemplateRequestError()
    }
  }
  const prepared = await preparePaint(ownerId, projectId, options, official)
  try {
    return await client.$transaction(async tx => {
      const raced = await tx.project.findUnique({ where: { id: projectId } })
      if (raced) { if (!official && raced.authorId !== ownerId) throw new Error('模板副本归属异常。'); return raced }
      return installProject(tx, ownerId, projectId, prepared, official)
    }, { timeout: 15000 })
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error
    const won = await client.project.findUnique({ where: { id: projectId } })
    if (!won || (!official && won.authorId !== ownerId)) throw error
    return won
  }
}

export async function createPaintTemplate(ownerId: string, requestId: string, options: PaintOptions = {}): Promise<PaintTemplateEntry> {
  if (!z.string().uuid().safeParse(requestId).success) throw new Error('创建请求无效。')
  const projectId = scoped(ownerId, requestId)
  const project = await installPaintPrologue(options.client || prisma, ownerId, projectId, false, options)
  return { id: project.id, title: project.title, focusNodeId: scoped(projectId, `node-${starterCard().id}`), focusSceneId: scoped(projectId, 'scene-your-next-scene') }
}
