import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Prisma, type PrismaClient } from '@prisma/client'
import { PAINT_PROLOGUE, type StoryGraph } from '@dreamchord/story-domain'
import { preflightPaintDefinition, type PaintDefinition, type PaintOptions } from './paintTemplate.js'

const officialId = 'dreamchord-paint-prologue'
const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../assets/story-packs/paint-prologue/release-v1.json')
export interface PaintUpgradeOptions extends PaintOptions { release?: PaintDefinition; currentDefinition?: PaintDefinition }
export interface PaintUpgradeResult { status: 'upgraded' | 'current'; projectId: string; chapterId: string; beforeFingerprint: string; afterFingerprint: string; previousVersion: number; version: number }
const include = Prisma.validator<Prisma.ProjectInclude>()({
  author: { select: { username: true } },
  chapters: { include: { nodes: true, edges: true } },
  characters: { include: { sprites: true, voiceBinding: { include: { profile: { include: { references: { include: { asset: true } } } } } } } },
})
type StoredProject = Prisma.ProjectGetPayload<{ include: typeof include }>
// Shared by append-only chapter releases; normalization never writes source data.
export { include as paintReleaseInclude, expectedDefinition as expectedPaintRelease, storedDefinition as storedPaintRelease, fingerprint as paintReleaseFingerprint }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
// Published packs keep their original labels. Treat the official renamed labels
// as equivalent solely when checking the frozen release fingerprint.
const releaseTitleAliases: Record<string, string> = {
  '夏日来信与未完之画': '请让这幅画老去',
  '序章 · 写在入场券背面的邀请': '序章 · 多出来的一把椅子',
  '第一章 · 为六月留一张明信片': '第一章 · 今天也有一场坏戏',
  '第二章 · 拆开信的那个下午': '第二章 · 她今天不想笑',
  '第三章 · 风从夏日手记吹来': '第三章 · 画外的夏天',
  '第四章 · 在画纸之外落笔': '第四章 · 另一双手',
  '春日仍有余白': '请让这幅画老去',
  '画框之外，尚有春天': '请让这幅画老去',
  '序章 · 为雨留一张空椅': '序章 · 多出来的一把椅子',
  '第一章 · 炉火旁未完成的戏': '第一章 · 今天也有一场坏戏',
  '第二章 · 写在回信之前': '第二章 · 她今天不想笑',
  '第三章 · 海风经过画纸背面': '第三章 · 画外的夏天',
  '第四章 · 未署名的落笔': '第四章 · 另一双手',
}
const releaseTitle = (title: string) => releaseTitleAliases[title] || title
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => compare(a, b)).map(([k, v]) => [k, ordered(v)]))
  return value
}
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex')
function normalizeData(source: Record<string, unknown>, names: Map<string, string>) {
  const data = structuredClone(source)
  if (typeof data.characterId === 'string') data.characterId = names.get(data.characterId) || data.characterId
  const tracks = data.voiceTracks
  if (tracks && typeof tracks === 'object' && !Array.isArray(tracks)) for (const track of Object.values(tracks)) {
    if (track && typeof track === 'object' && !Array.isArray(track)) { delete track.profileId; delete track.referenceId }
  }
  return data
}
function normalizedGraph(graph: StoryGraph, names: Map<string, string>) {
  return {
    nodes: graph.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: normalizeData(n.data, names) })).sort((a, b) => compare(a.id, b.id)),
    edges: graph.edges.map(e => ({ id: e.id, source: e.source, target: e.target, animated: e.animated, label: e.label ?? null, sourceHandle: e.sourceHandle ?? null })).sort((a, b) => compare(a.id, b.id)),
  }
}
function expectedDefinition(definition: PaintDefinition) {
  const names = new Map<string, string>(definition.characters.flatMap(c => [[c.slug, c.name], [c.name, c.name]]))
  return {
    id: definition.id, title: releaseTitle(definition.title), description: definition.description, cover: definition.cover, defaultSubtitleLocale: 'zh', defaultVoiceLocale: 'ja',
    chapters: [{ title: releaseTitle(definition.chapterTitle), order: 0, graph: normalizedGraph(definition.graph, names) }],
    characters: definition.characters.map(({ slug, ...c }) => ({ ...c, sprites: (slug === 'lu' ? ['normal'] : ['normal', 'smile', 'serious']).map(name => ({ name, url: `/assets/paint-prologue/${slug}-${name}.png` })).sort((a, b) => compare(a.name, b.name)) })).sort((a, b) => compare(a.name, b.name)),
  }
}
function storedDefinition(project: StoredProject) {
  const names = new Map(project.characters.map(c => [c.id, c.name]))
  return {
    id: project.id, title: releaseTitle(project.title), description: project.description, cover: project.cover, defaultSubtitleLocale: project.defaultSubtitleLocale, defaultVoiceLocale: project.defaultVoiceLocale,
    chapters: project.chapters.map(c => ({ title: releaseTitle(c.title), order: c.order, graph: normalizedGraph({ nodes: c.nodes.map(n => ({ id: n.nodeId, type: n.type as StoryGraph['nodes'][number]['type'], position: { x: n.positionX, y: n.positionY }, data: JSON.parse(n.data) as Record<string, unknown> })), edges: c.edges.map(e => ({ id: e.edgeId, source: e.source, target: e.target, label: e.label ?? undefined, sourceHandle: e.sourceHandle ?? undefined, animated: e.animated })) }, names) })).sort((a, b) => a.order - b.order || compare(a.title, b.title)),
    characters: project.characters.map(c => ({ name: c.name, description: c.description, color: c.color, defaultSprite: c.defaultSprite, sprites: c.sprites.map(s => ({ name: s.name, url: s.url })).sort((a, b) => compare(a.name, b.name)) })).sort((a, b) => compare(a.name, b.name)),
  }
}
function guard(project: StoredProject | null, ownerId: string): asserts project is StoredProject {
  if (!project || project.id !== officialId || project.authorId !== ownerId || project.author.username !== 'demo' || !project.isPublic || !project.isPublished || project.chapters.length !== 1) throw new Error('拒绝升级：仅允许原demo作者公开发布的固定官方序章。')
}
function safeStoredFingerprint(project: StoredProject) {
  try { return fingerprint(storedDefinition(project)) }
  catch { throw new Error('拒绝升级：官方项目数据与已发布版本不匹配。') }
}

/** Explicit opt-in upgrade. Ordinary seeding remains create-only. No force option exists. */
export async function upgradePaintPrologue(client: PrismaClient, ownerId: string, options: PaintUpgradeOptions = {}): Promise<PaintUpgradeResult> {
  const release = options.release || JSON.parse(await readFile(releaseFile, 'utf8')) as PaintDefinition
  const current = options.currentDefinition || PAINT_PROLOGUE
  if (release.id !== officialId || current.id !== officialId) throw new Error('拒绝升级：版本不是固定官方序章。')
  const oldDefinition = expectedDefinition(release), newDefinition = expectedDefinition(current)
  if (fingerprint(oldDefinition.characters) !== fingerprint(newDefinition.characters)) throw new Error('拒绝升级：本次升级不得改写已有角色设定。')
  const oldFingerprint = fingerprint(oldDefinition), newFingerprint = fingerprint(newDefinition)
  const project = await client.project.findUnique({ where: { id: officialId }, include })
  guard(project, ownerId)
  const beforeFingerprint = safeStoredFingerprint(project)
  const chapter = project.chapters[0]
  const result = (status: 'upgraded' | 'current', before: string, after: string, version: number): PaintUpgradeResult => ({ status, projectId: officialId, chapterId: chapter.id, beforeFingerprint: before, afterFingerprint: after, previousVersion: chapter.version, version })
  if (beforeFingerprint === newFingerprint) return result('current', beforeFingerprint, beforeFingerprint, chapter.version)
  if (beforeFingerprint !== oldFingerprint) throw new Error('拒绝升级：官方项目已被修改，与旧发布版本不匹配。')
  const prepared = await preflightPaintDefinition(current, options)
  return client.$transaction(async tx => {
    const fresh = await tx.project.findUnique({ where: { id: officialId }, include })
    guard(fresh, ownerId)
    if (safeStoredFingerprint(fresh) !== beforeFingerprint || fresh.chapters[0].version !== chapter.version) throw new Error('拒绝升级：预检期间项目已修改，请重新检查。')
    const locked = await tx.chapter.updateMany({ where: { id: chapter.id, version: chapter.version }, data: { version: { increment: 1 }, title: current.chapterTitle } })
    if (locked.count !== 1) throw new Error('拒绝升级：章节版本已变化。')
    const nodes = structuredClone(current.graph.nodes)
    for (const node of nodes) {
      if (typeof node.data.characterId === 'string') {
        const character = current.characters.find(c => c.slug === node.data.characterId || c.name === node.data.characterId)
        const stored = fresh.characters.find(c => c.name === character?.name)
        if (!stored) throw new Error('拒绝升级：角色映射不完整。')
        node.data.characterId = stored.id
      }
      const tracks = node.data.voiceTracks as Record<string, { url?: string; profileId?: string; referenceId?: string }> | undefined
      if (tracks) {
        const definition = current.characters.find(c => c.slug === node.data.role || c.name === node.data.role)
        const character = fresh.characters.find(c => c.name === definition?.name)
        const binding = character?.voiceBinding
        if (!binding || binding.profile.ownerId !== ownerId || binding.projectId !== officialId) throw new Error('拒绝升级：已有角色音色归属无效。')
        for (const [language, track] of Object.entries(tracks)) {
          const selectedId = prepared.takeReferences.get(track.url || '')
          const selected = prepared.references.find(r => r.id === selectedId && r.role === definition?.slug)
          const reference = binding.profile.references.find(r => {
            if (!selected || r.language !== language || r.transcript !== selected.text || r.asset.ownerId !== ownerId) return false
            try { return (JSON.parse(r.asset.metadata) as { sha256?: string }).sha256 === selected.sha256 } catch { return false }
          })
          if (language !== 'ja' || !reference) throw new Error('拒绝升级：已绑定参考音频与预录音轨不匹配。')
          track.profileId = binding.profileId; track.referenceId = reference.id
        }
      }
    }
    await tx.flowEdge.deleteMany({ where: { chapterId: chapter.id, edgeId: { notIn: current.graph.edges.map(e => e.id) } } })
    await tx.flowNode.deleteMany({ where: { chapterId: chapter.id, nodeId: { notIn: nodes.map(n => n.id) } } })
    for (const node of nodes) {
      const data = { type: node.type, positionX: node.position.x, positionY: node.position.y, data: JSON.stringify(node.data) }
      await tx.flowNode.upsert({ where: { chapterId_nodeId: { chapterId: chapter.id, nodeId: node.id } }, create: { chapterId: chapter.id, nodeId: node.id, ...data }, update: data })
    }
    for (const edge of current.graph.edges) {
      const data = { source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? null, label: edge.label ?? null, animated: edge.animated }
      await tx.flowEdge.upsert({ where: { chapterId_edgeId: { chapterId: chapter.id, edgeId: edge.id } }, create: { chapterId: chapter.id, edgeId: edge.id, ...data }, update: data })
    }
    await tx.project.update({ where: { id: officialId }, data: { title: current.title, description: current.description, cover: current.cover } })
    const after = await tx.project.findUniqueOrThrow({ where: { id: officialId }, include })
    const afterFingerprint = safeStoredFingerprint(after)
    if (afterFingerprint !== newFingerprint) throw new Error('拒绝升级：写入后指纹与新发布版本不匹配。')
    return result('upgraded', beforeFingerprint, afterFingerprint, chapter.version + 1)
  }, { timeout: 15000 })
}
