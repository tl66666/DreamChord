import { randomUUID } from 'node:crypto'
import { applyStoryPatch, createStoryPatchDiff, storyPatchSchema, type StoryGraph, type StoryNodeType } from '@dreamchord/story-domain'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class StoryPatchConflictError extends Error {}
export class StoryPatchAccessError extends Error {}

function parseData(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>
  } catch { return {} }
  return {}
}

function databaseGraph(chapter: {
  nodes: Array<{ nodeId: string; type: string; positionX: number; positionY: number; data: string }>
  edges: Array<{ edgeId: string; source: string; target: string; label: string | null; sourceHandle: string | null; animated: boolean }>
}): StoryGraph {
  return {
    nodes: chapter.nodes.map((node) => ({ id: node.nodeId, type: node.type as StoryNodeType, position: { x: node.positionX, y: node.positionY }, data: parseData(node.data) })),
    edges: chapter.edges.map((edge) => ({ id: edge.edgeId, source: edge.source, target: edge.target, label: edge.label ?? undefined, sourceHandle: edge.sourceHandle ?? undefined, animated: edge.animated })),
  }
}

function parseSnapshot(raw: string): StoryGraph {
  const value: unknown = JSON.parse(raw)
  if (typeof value !== 'object' || value === null || !('nodes' in value) || !('edges' in value)) throw new Error('章节快照损坏')
  return value as StoryGraph
}

async function replaceGraph(tx: Prisma.TransactionClient, chapterId: string, graph: StoryGraph): Promise<void> {
  await tx.flowEdge.deleteMany({ where: { chapterId } })
  await tx.flowNode.deleteMany({ where: { chapterId } })
  if (graph.nodes.length > 0) {
    await tx.flowNode.createMany({
      data: graph.nodes.map((node) => ({ chapterId, nodeId: node.id, type: node.type, positionX: node.position.x, positionY: node.position.y, data: JSON.stringify(node.data) })),
    })
  }
  if (graph.edges.length > 0) {
    await tx.flowEdge.createMany({
      data: graph.edges.map((edge) => ({ chapterId, edgeId: edge.id, source: edge.source, target: edge.target, label: edge.label ?? null, sourceHandle: edge.sourceHandle ?? null, animated: edge.animated })),
    })
  }
}

export async function applyPersistedStoryPatch(
  input: { patchId: string; userId: string },
  client: PrismaClient = prisma,
): Promise<{ chapterId: string; version: number; graph: StoryGraph }> {
  return client.$transaction(async (tx) => {
    const patch = await tx.storyPatch.findUnique({
      where: { id: input.patchId },
      include: { project: { select: { authorId: true } }, chapter: { include: { nodes: true, edges: true } } },
    })
    if (!patch) throw new StoryPatchAccessError('补丁不存在')
    if (patch.project.authorId !== input.userId) throw new StoryPatchAccessError('无权应用此补丁')
    if (patch.status !== 'proposed') throw new StoryPatchConflictError('补丁已处理')
    if (patch.chapter.version !== patch.baseVersion) throw new StoryPatchConflictError('章节版本已变化')

    const before = databaseGraph(patch.chapter)
    const parsed = storyPatchSchema.parse(JSON.parse(patch.payload))
    const applied = applyStoryPatch(before, parsed, randomUUID)
    if (!applied.validation.valid) throw new StoryPatchConflictError('补丁未通过图结构校验')
    const nextVersion = patch.baseVersion + 1

    const claimed = await tx.chapter.updateMany({ where: { id: patch.chapterId, version: patch.baseVersion }, data: { version: nextVersion } })
    if (claimed.count !== 1) throw new StoryPatchConflictError('章节版本已变化')
    await tx.chapterSnapshot.create({ data: { patchId: patch.id, chapterId: patch.chapterId, nodes: JSON.stringify(before), edges: JSON.stringify(before.edges), version: patch.baseVersion } })
    await replaceGraph(tx, patch.chapterId, applied.graph)
    await tx.storyPatch.update({
      where: { id: patch.id },
      data: { status: 'applied', appliedVersion: nextVersion, validation: JSON.stringify(applied.validation), diff: JSON.stringify(createStoryPatchDiff(before, applied.graph)) },
    })
    await tx.agentRun.update({ where: { id: patch.runId }, data: { status: 'completed', completedAt: new Date() } })
    return { chapterId: patch.chapterId, version: nextVersion, graph: applied.graph }
  })
}

export async function undoPersistedStoryPatch(
  input: { patchId: string; userId: string },
  client: PrismaClient = prisma,
): Promise<{ chapterId: string; version: number; graph: StoryGraph }> {
  return client.$transaction(async (tx) => {
    const patch = await tx.storyPatch.findUnique({
      where: { id: input.patchId },
      include: { project: { select: { authorId: true } }, chapter: { select: { version: true } }, snapshot: true },
    })
    if (!patch || !patch.snapshot) throw new StoryPatchAccessError('补丁或快照不存在')
    if (patch.project.authorId !== input.userId) throw new StoryPatchAccessError('无权撤销此补丁')
    if (patch.status !== 'applied' || patch.appliedVersion === null) throw new StoryPatchConflictError('补丁当前不可撤销')
    if (patch.chapter.version !== patch.appliedVersion) throw new StoryPatchConflictError('章节在应用后已继续修改')

    const graph = parseSnapshot(patch.snapshot.nodes)
    const nextVersion = patch.chapter.version + 1
    const claimed = await tx.chapter.updateMany({ where: { id: patch.chapterId, version: patch.appliedVersion }, data: { version: nextVersion } })
    if (claimed.count !== 1) throw new StoryPatchConflictError('章节在应用后已继续修改')
    await replaceGraph(tx, patch.chapterId, graph)
    await tx.storyPatch.update({ where: { id: patch.id }, data: { status: 'undone' } })
    return { chapterId: patch.chapterId, version: nextVersion, graph }
  })
}
