import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Prisma, PrismaClient } from '@prisma/client'
import * as story from '@dreamchord/story-domain'
import { preflightPaintDefinition, type PaintDefinition, type PaintOptions } from './paintTemplate.js'
import { expectedPaintRelease, storedPaintRelease, paintReleaseInclude as include, paintReleaseFingerprint as hash } from './paintUpgrade.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const id = 'dreamchord-paint-prologue'
type Stored = Prisma.ProjectGetPayload<{ include: typeof include }>
type Prepared = Awaited<ReturnType<typeof preflightPaintDefinition>>
export interface PaintBookReleaseOptions extends PaintOptions { releaseDefinitions?: PaintDefinition[]; currentDefinitions?: PaintDefinition[]; packRoots?: string[]; checkOnly?: boolean }

/** The book's last chapter owns the synopsis; each graph keeps its own scene codes. */
export function expectedPaintBook(definitions: PaintDefinition[]) {
  const first = expectedPaintRelease(definitions[0])
  return { ...first, description: definitions.at(-1)!.description, chapters: definitions.map((definition, order) => ({ ...expectedPaintRelease(definition).chapters[0], order })) }
}
function fingerprint(project: Stored) {
  try { return hash(storedPaintRelease(project)) }
  catch { throw new Error('拒绝发布：官方作品数据无法与发布稿核对。') }
}
function guard(project: Stored | null, ownerId: string, characters: PaintDefinition['characters'], releasedCount: number): asserts project is Stored {
  if (!project || project.id !== id || project.authorId !== ownerId || project.author.username !== 'demo' || !project.isPublic || !project.isPublished) throw new Error('拒绝发布：仅允许原 demo 作者公开发布的固定官方作品。')
  if (![releasedCount, releasedCount + 1].includes(project.chapters.length) || project.chapters.some((c, _, all) => c.order < 0 || c.order >= all.length || all.filter(d => d.order === c.order).length !== 1)) throw new Error('拒绝发布：作品存在额外章节或章节顺序异常。')
  if (project.characters.length !== characters.length || project.characters.some(c => {
    const slug = characters.find(d => d.name === c.name)?.slug, binding = c.voiceBinding
    return !slug || !binding || binding.characterId !== c.id || binding.projectId !== id || binding.profile.ownerId !== ownerId || binding.profileId !== `paint-voice-${slug}` || binding.profile.language !== 'ja'
  })) throw new Error('拒绝发布：原有角色声音绑定已修改。')
}
function matchingReference(binding: NonNullable<Stored['characters'][number]['voiceBinding']>, reference: Prepared['references'][number], ownerId: string, preferredId?: string) {
  const matches = binding.profile.references.filter(r => {
    if (r.language !== reference.language || r.transcript !== reference.text || r.asset.ownerId !== ownerId || !r.authorizationConfirmed) return false
    try { return JSON.parse(r.asset.metadata).sha256 === reference.sha256 } catch { return false }
  })
  return matches.find(r => r.id === preferredId) || matches[0]
}
function verifyReferences(project: Stored, definitions: PaintDefinition[], prepared: Prepared[], ownerId: string) {
  for (const [index, definition] of definitions.entries()) for (const c of definition.characters) {
    const binding = project.characters.find(s => s.name === c.name)?.voiceBinding
    if (!binding || prepared[index].references.filter(r => r.role === c.slug).some(r => !matchingReference(binding, r, ownerId))) throw new Error('拒绝发布：原绑定音色参考文本或 SHA 与预录包不匹配。')
  }
  // Profile/reference IDs are intentionally absent from the canonical graph hash;
  // validate those IDs separately so normalization cannot conceal an author edit.
  for (const chapter of project.chapters) for (const node of chapter.nodes) {
    const data = JSON.parse(node.data), tracks = data.voiceTracks as Record<string, { profileId?: string; referenceId?: string; url?: string }> | undefined
    for (const [language, track] of Object.entries(tracks || {})) {
      const definition = definitions[chapter.order], c = definition.characters.find(c => c.name === data.role || c.slug === data.role)
      const binding = project.characters.find(s => s.name === c?.name)?.voiceBinding
      const selectedId = prepared[chapter.order].takeReferences.get(track.url || '')
      const selected = prepared[chapter.order].references.find(r => r.id === selectedId && r.role === c?.slug)
      const reference = binding?.profile.references.find(r => r.id === track.referenceId)
      if (language !== 'ja' || !binding || track.profileId !== binding.profileId || !reference || !selected || matchingReference({ ...binding, profile: { ...binding.profile, references: [reference] } }, selected, ownerId)?.id !== reference.id) throw new Error('拒绝发布：已有音轨的原角色参考绑定已修改。')
    }
  }
}
function boundNodes(definition: PaintDefinition, project: Stored, prepared: Prepared, ownerId: string, order: number) {
  const nodes = structuredClone(definition.graph.nodes)
  for (const node of nodes) {
    if (typeof node.data.characterId === 'string') {
      const c = definition.characters.find(c => c.slug === node.data.characterId || c.name === node.data.characterId)
      const character = project.characters.find(s => s.name === c?.name)
      if (!character) throw new Error('拒绝发布：角色映射不完整。')
      node.data.characterId = character.id
    }
    const tracks = node.data.voiceTracks as Record<string, { url?: string; profileId?: string; referenceId?: string }> | undefined
    for (const [language, track] of Object.entries(tracks || {})) {
      const c = definition.characters.find(c => c.name === node.data.role || c.slug === node.data.role)
      const binding = project.characters.find(s => s.name === c?.name)?.voiceBinding
      const selectedId = prepared.takeReferences.get(track.url || '')
      const selected = prepared.references.find(r => r.id === selectedId && r.role === c?.slug)
      const oldNode = project.chapters.find(c => c.order === order)?.nodes.find(n => n.nodeId === node.id)
      const oldTrack = oldNode ? (JSON.parse(oldNode.data).voiceTracks as Record<string, { referenceId?: string }> | undefined)?.[language] : undefined
      const reference = binding && selected ? matchingReference(binding, selected, ownerId, oldTrack?.referenceId) : undefined
      if (language !== 'ja' || !binding || !reference) throw new Error('拒绝发布：原角色参考与预录音轨不匹配。')
      track.profileId = binding.profileId; track.referenceId = reference.id
    }
  }
  return nodes
}
async function writeChapter(tx: Prisma.TransactionClient, chapterId: string, definition: PaintDefinition, nodes: ReturnType<typeof boundNodes>) {
  await tx.flowEdge.deleteMany({ where: { chapterId, edgeId: { notIn: definition.graph.edges.map(e => e.id) } } })
  await tx.flowNode.deleteMany({ where: { chapterId, nodeId: { notIn: nodes.map(n => n.id) } } })
  for (const node of nodes) {
    const data = { type: node.type, positionX: node.position.x, positionY: node.position.y, data: JSON.stringify(node.data) }
    await tx.flowNode.upsert({ where: { chapterId_nodeId: { chapterId, nodeId: node.id } }, create: { chapterId, nodeId: node.id, ...data }, update: data })
  }
  for (const edge of definition.graph.edges) {
    const data = { source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? null, label: edge.label ?? null, animated: edge.animated }
    await tx.flowEdge.upsert({ where: { chapterId_edgeId: { chapterId, edgeId: edge.id } }, create: { chapterId, edgeId: edge.id, ...data }, update: data })
  }
}

/** Explicit, fingerprint-guarded release. No force option and no private-copy writes. */
export async function releasePaintBook(client: PrismaClient, ownerId: string, options: PaintBookReleaseOptions = {}) {
  const release = options.releaseDefinitions || (JSON.parse(await readFile(path.join(root, 'assets/story-packs/paint-book/release-two-chapters-v1.json'), 'utf8')) as { chapters: PaintDefinition[] }).chapters
  const chapterTwo = (story as typeof story & { PAINT_CHAPTER_TWO?: PaintDefinition }).PAINT_CHAPTER_TWO
  const definitions = options.currentDefinitions || (chapterTwo ? [story.PAINT_PROLOGUE, story.PAINT_CHAPTER_ONE, chapterTwo] : [])
  if (![2, 3].includes(release.length) || definitions.length !== release.length + 1 || [...release, ...definitions].some(d => d.id !== id)) throw new Error('拒绝发布：仅支持固定作品已登记的两章至三章、三章至四章版本。')
  const oldBook = expectedPaintBook(release), newBook = expectedPaintBook(definitions)
  if ([...release, ...definitions].some(d => hash(expectedPaintRelease(d).characters) !== hash(oldBook.characters))) throw new Error('拒绝发布：本次版本不得改写原角色设定。')
  const project = await client.project.findUnique({ where: { id }, include })
  guard(project, ownerId, release[0].characters, release.length)
  const before = fingerprint(project), target = hash(newBook)
  const currentBaseFingerprint = hash(expectedPaintBook(definitions.slice(0, -1)))
  if (before !== target && before !== hash(oldBook) && before !== currentBaseFingerprint) throw new Error('拒绝发布：作品已有改写或额外章节，与冻结旧稿或当前基础章节发布指纹不匹配。')
  const packRoots = options.packRoots || ['paint-prologue', 'paint-chapter-one', 'paint-chapter-two'].map(name => path.join(root, 'assets/voice-packs', name))
  if (packRoots.length !== definitions.length) throw new Error('拒绝发布：必须预检本次发布全部章节音色包。')
  const prepared: Prepared[] = []
  for (const [index, definition] of definitions.entries()) prepared.push(await preflightPaintDefinition(definition, { ...options, packRoot: packRoots[index] }))
  verifyReferences(project, definitions, prepared, ownerId)
  const versions = new Map(project.chapters.map(c => [c.id, c.version]))
  const result = (status: 'released' | 'current' | 'ready', after: Stored) => ({ status, projectId: id, beforeFingerprint: before, afterFingerprint: fingerprint(after), targetFingerprint: target, chapters: after.chapters.sort((a, b) => a.order - b.order).map(c => ({ id: c.id, order: c.order, previousVersion: versions.get(c.id) ?? null, version: c.version })) })
  return client.$transaction(async tx => {
    const fresh = await tx.project.findUnique({ where: { id }, include })
    guard(fresh, ownerId, release[0].characters, release.length)
    if (fingerprint(fresh) !== before || fresh.chapters.some(c => versions.get(c.id) !== c.version)) throw new Error('拒绝发布：预检期间作品指纹或章节版本已变化。')
    verifyReferences(fresh, definitions, prepared, ownerId)
    if (before === target) return result('current', fresh)
    if (options.checkOnly) return result('ready', fresh)
    // Acquire the SQLite write lock with a version CAS before any release writes.
    const anchor = fresh.chapters.find(c => c.order === 0)!
    const locked = await tx.chapter.updateMany({ where: { id: anchor.id, version: anchor.version }, data: { version: anchor.version, updatedAt: anchor.updatedAt } })
    if (locked.count !== 1) throw new Error('拒绝发布：章节版本已变化。')
    const previous = storedPaintRelease(fresh)
    for (const [order, definition] of definitions.entries()) {
      const chapter = fresh.chapters.find(c => c.order === order)
      if (chapter && hash(previous.chapters.find(c => c.order === order)) === hash(newBook.chapters[order])) continue
      const nodes = boundNodes(definition, fresh, prepared[order], ownerId, order)
      let chapterId: string
      if (chapter) {
        const updated = await tx.chapter.updateMany({ where: { id: chapter.id, version: chapter.version }, data: { version: { increment: 1 }, title: definition.chapterTitle } })
        if (updated.count !== 1) throw new Error('拒绝发布：章节版本已变化。')
        chapterId = chapter.id
      } else chapterId = (await tx.chapter.create({ data: { projectId: id, order, title: definition.chapterTitle } })).id
      await writeChapter(tx, chapterId, definition, nodes)
    }
    for (const music of new Map(prepared.flatMap(p => p.music).map(m => [m.url, m])).values()) {
      const existing = await tx.asset.findFirst({ where: { projectId: id, type: 'BGM', url: music.url } })
      if (!existing) await tx.asset.create({ data: { projectId: id, ownerId, name: music.name, type: 'BGM', url: music.url, mimeType: 'audio/ogg', metadata: music.metadata } })
    }
    await tx.project.update({ where: { id }, data: { title: newBook.title, description: newBook.description, cover: newBook.cover } })
    const after = await tx.project.findUniqueOrThrow({ where: { id }, include })
    if (fingerprint(after) !== target) throw new Error('拒绝发布：写入后的整书指纹与新发布稿不匹配。')
    return result('released', after)
  }, { timeout: 30000 })
}
