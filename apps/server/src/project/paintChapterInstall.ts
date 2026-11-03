import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient, Prisma } from '@prisma/client'
import { PAINT_PROLOGUE, PAINT_CHAPTER_ONE } from '@dreamchord/story-domain'
import { preflightPaintDefinition, type PaintOptions } from './paintTemplate.js'
import { paintReleaseInclude as include, expectedPaintRelease, storedPaintRelease, paintReleaseFingerprint as hash } from './paintUpgrade.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const id = PAINT_PROLOGUE.id
type Stored = Prisma.ProjectGetPayload<{ include: typeof include }>
function expectedBook() {
  const prologue = expectedPaintRelease(PAINT_PROLOGUE)
  const chapter = expectedPaintRelease(PAINT_CHAPTER_ONE).chapters[0]
  return { ...prologue, description: PAINT_CHAPTER_ONE.description, chapters: [...prologue.chapters, { ...chapter, order: 1 }] }
}
function guard(project: Stored | null, ownerId: string): asserts project is Stored {
  if (!project || project.id !== id || project.authorId !== ownerId || project.author.username !== 'demo' || !project.isPublic || !project.isPublished) throw new Error('拒绝安装：仅允许原 demo 作者的公开官方作品。')
  if (project.characters.some(c => !c.voiceBinding || c.voiceBinding.projectId !== id || c.voiceBinding.profile.ownerId !== ownerId || c.voiceBinding.profileId !== `paint-voice-${PAINT_PROLOGUE.characters.find(d => d.name === c.name)?.slug}`)) throw new Error('拒绝安装：原有角色声音绑定已修改。')
}
function fingerprint(project: Stored) {
  try { return hash(storedPaintRelease(project)) }
  catch { throw new Error('拒绝安装：项目数据无法与发布稿核对。') }
}

/** Explicit release operation. Never edits chapter zero, private copies, or library profiles. */
export async function installPaintChapterOne(client: PrismaClient, ownerId: string, options: PaintOptions = {}) {
  const project = await client.project.findUnique({ where: { id }, include })
  guard(project, ownerId)
  const before = fingerprint(project), target = hash(expectedBook())
  if (before === target) return { status: 'current' as const, projectId: id, chapterId: project.chapters.find(c => c.order === 1)!.id, fingerprint: target }
  if (before !== hash(expectedPaintRelease(PAINT_PROLOGUE))) throw new Error('拒绝安装：作品已有改写或额外章节，与序章发布稿不匹配。')
  const prepared = await preflightPaintDefinition(PAINT_CHAPTER_ONE, { ...options, packRoot: options.packRoot || path.join(root, 'assets/voice-packs/paint-chapter-one') })
  const versions = new Map(project.chapters.map(c => [c.id, c.version]))
  return client.$transaction(async tx => {
    const fresh = await tx.project.findUnique({ where: { id }, include })
    guard(fresh, ownerId)
    if (fingerprint(fresh) !== before || fresh.chapters.some(c => versions.get(c.id) !== c.version)) throw new Error('拒绝安装：预检期间项目已修改。')
    // A no-op compare-and-set takes SQLite's write lock without changing chapter zero.
    const lock = await tx.chapter.updateMany({ where: { id: fresh.chapters[0].id, version: fresh.chapters[0].version }, data: { version: fresh.chapters[0].version, updatedAt: fresh.chapters[0].updatedAt } })
    if (lock.count !== 1) throw new Error('拒绝安装：序章版本已变化。')
    const nodes = structuredClone(PAINT_CHAPTER_ONE.graph.nodes)
    for (const node of nodes) {
      if (typeof node.data.characterId === 'string') {
        const character = fresh.characters.find(c => c.name === node.data.characterId)
        if (!character) throw new Error('拒绝安装：角色映射缺失。')
        node.data.characterId = character.id
      }
      const tracks = node.data.voiceTracks as Record<string, { url?: string; profileId?: string; referenceId?: string }> | undefined
      for (const [language, track] of Object.entries(tracks || {})) {
        const character = fresh.characters.find(c => c.name === node.data.role)
        const slug = PAINT_CHAPTER_ONE.characters.find(c => c.name === character?.name)?.slug
        const referenceId = prepared.takeReferences.get(track.url || '')
        const reference = prepared.references.find(r => r.id === referenceId && r.role === slug)
        const binding = character?.voiceBinding
        const stored = binding?.profile.references.find(r => {
          if (!reference || r.language !== language || r.transcript !== reference.text || r.asset.ownerId !== ownerId || !r.authorizationConfirmed) return false
          try { return JSON.parse(r.asset.metadata).sha256 === reference.sha256 } catch { return false }
        })
        if (language !== 'ja' || !binding || !stored) throw new Error('拒绝安装：现有角色参考与预录音轨不匹配。')
        track.profileId = binding.profileId; track.referenceId = stored.id
      }
    }
    const chapter = await tx.chapter.create({ data: {
      projectId: id, order: 1, title: PAINT_CHAPTER_ONE.chapterTitle,
      nodes: { create: nodes.map(n => ({ nodeId: n.id, type: n.type, positionX: n.position.x, positionY: n.position.y, data: JSON.stringify(n.data) })) },
      edges: { create: PAINT_CHAPTER_ONE.graph.edges.map(e => ({ edgeId: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, label: e.label, animated: e.animated })) },
    } })
    await tx.project.update({ where: { id }, data: { description: PAINT_CHAPTER_ONE.description } })
    const after = await tx.project.findUniqueOrThrow({ where: { id }, include })
    if (fingerprint(after) !== target) throw new Error('拒绝安装：写入后的章节与发布稿不符。')
    return { status: 'installed' as const, projectId: id, chapterId: chapter.id, fingerprint: target }
  }, { timeout: 15000 })
}
