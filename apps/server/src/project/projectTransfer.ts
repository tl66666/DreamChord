import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const safeUrl = z.string().max(2_000).refine((url) => !/^(?:[a-z]:[\\/]|file:)/i.test(url), '不允许本地绝对路径')
const nodeSchema = z.object({ nodeId: z.string().min(1), type: z.string().min(1), positionX: z.number(), positionY: z.number(), data: z.record(z.unknown()) }).strict()
const edgeSchema = z.object({ edgeId: z.string().min(1), source: z.string().min(1), target: z.string().min(1), label: z.string().nullable(), sourceHandle: z.string().nullable(), animated: z.boolean() }).strict()
const memorySchema = z.object({ kind: z.enum(['canon', 'character', 'preference', 'plot', 'decision', 'artifact']), title: z.string().min(1).max(200), content: z.string().min(1).max(20_000), tags: z.array(z.string().max(50)).max(30), importance: z.number().int().min(0).max(100), isPinned: z.boolean(), sourceType: z.string().max(100) }).strict()

export const projectManifestSchema = z.object({
  format: z.literal('dreamchord-project'), version: z.literal(1), exportedAt: z.string().datetime(),
  project: z.object({ title: z.string().min(1).max(200), description: z.string().max(10_000), cover: safeUrl }).strict(),
  storyBible: z.unknown().nullable(),
  chapters: z.array(z.object({ title: z.string().min(1).max(200), order: z.number().int(), version: z.number().int().min(1), nodes: z.array(nodeSchema).max(20_000), edges: z.array(edgeSchema).max(30_000) }).strict()).max(1_000),
  characters: z.array(z.object({ name: z.string().min(1).max(100), description: z.string().max(10_000), color: z.string().max(50), defaultSprite: safeUrl, sprites: z.array(z.object({ name: z.string().min(1).max(100), url: safeUrl }).strict()).max(500) }).strict()).max(2_000),
  assets: z.array(z.object({ name: z.string().min(1).max(200), type: z.string().min(1).max(50), url: safeUrl, mimeType: z.string().nullable(), width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(), hasAlpha: z.boolean().nullable() }).strict()).max(10_000),
  memories: z.array(memorySchema).max(10_000),
}).strict()
export type ProjectManifest = z.infer<typeof projectManifestSchema>

function parseJson(value: string): unknown { try { return JSON.parse(value) } catch { return null } }
function parseObject(value: string): Record<string, unknown> { const parsed = parseJson(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {} }
function parseTags(value: string): string[] { const parsed = parseJson(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [] }

export async function exportProject(projectId: string, userId: string, client: PrismaClient = prisma): Promise<ProjectManifest> {
  const project = await client.project.findUnique({ where: { id: projectId }, include: {
    storyBible: true, chapters: { orderBy: { order: 'asc' }, include: { nodes: true, edges: true } },
    characters: { include: { sprites: true } }, assets: true, agentMemories: { where: { status: { not: 'forgotten' }, supersededById: null, conversationId: null } },
  } })
  if (!project) throw new Error('项目不存在')
  if (project.authorId !== userId) throw new Error('无权导出此项目')
  return projectManifestSchema.parse({
    format: 'dreamchord-project', version: 1, exportedAt: new Date().toISOString(),
    project: { title: project.title, description: project.description ?? '', cover: project.cover }, storyBible: project.storyBible ? parseJson(project.storyBible.content) : null,
    chapters: project.chapters.map((chapter) => ({ title: chapter.title, order: chapter.order, version: chapter.version, nodes: chapter.nodes.map((node) => ({ nodeId: node.nodeId, type: node.type, positionX: node.positionX, positionY: node.positionY, data: parseObject(node.data) })), edges: chapter.edges.map((edge) => ({ edgeId: edge.edgeId, source: edge.source, target: edge.target, label: edge.label, sourceHandle: edge.sourceHandle, animated: edge.animated })) })),
    characters: project.characters.map((character) => ({ name: character.name, description: character.description ?? '', color: character.color, defaultSprite: character.defaultSprite, sprites: character.sprites.map((sprite) => ({ name: sprite.name, url: sprite.url })) })),
    assets: project.assets.map((asset) => ({ name: asset.name, type: asset.type, url: asset.url, mimeType: asset.mimeType, width: asset.width, height: asset.height, hasAlpha: asset.hasAlpha })),
    memories: project.agentMemories.map((memory) => ({ kind: memory.kind, title: memory.title, content: memory.content, tags: parseTags(memory.tags), importance: memory.importance, isPinned: memory.isPinned, sourceType: memory.sourceType })),
  })
}

export async function importProject(input: unknown, userId: string, client: PrismaClient = prisma): Promise<{ id: string; title: string }> {
  const parsed = projectManifestSchema.safeParse(input)
  if (!parsed.success) throw new Error(`备份格式无效：${parsed.error.issues[0]?.message ?? '无法解析'}`)
  const manifest = parsed.data
  return client.$transaction(async (tx) => {
    const project = await tx.project.create({ data: { title: `${manifest.project.title}（导入）`, description: manifest.project.description, cover: manifest.project.cover, authorId: userId } })
    if (manifest.storyBible !== null) await tx.storyBible.create({ data: { projectId: project.id, content: JSON.stringify(manifest.storyBible) } })
    for (const chapter of manifest.chapters) await tx.chapter.create({ data: { projectId: project.id, title: chapter.title, order: chapter.order, version: chapter.version, nodes: { create: chapter.nodes.map((node) => ({ nodeId: node.nodeId, type: node.type, positionX: node.positionX, positionY: node.positionY, data: JSON.stringify(node.data) })) }, edges: { create: chapter.edges } } })
    for (const character of manifest.characters) await tx.character.create({ data: { projectId: project.id, name: character.name, description: character.description, color: character.color, defaultSprite: character.defaultSprite, sprites: { create: character.sprites } } })
    if (manifest.assets.length) await tx.asset.createMany({ data: manifest.assets.map((asset) => ({ projectId: project.id, ...asset, status: 'missing-file', metadata: JSON.stringify({ importedInventory: true }) })) })
    if (manifest.memories.length) await tx.agentMemory.createMany({ data: manifest.memories.map((memory) => ({ projectId: project.id, userId, status: 'active', ...memory, tags: JSON.stringify(memory.tags), sourceType: `import:${memory.sourceType}` })) })
    return { id: project.id, title: project.title }
  })
}
