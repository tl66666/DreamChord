import { storyPatchSchema, type StoryPatch } from './schemas.js'
import type { StoryEdge, StoryGraph, StoryNode } from './types.js'

export interface StoryValidationError {
  code: 'duplicate-node-id' | 'duplicate-edge-id' | 'edge-reference-missing' | 'choice-handle-invalid'
  message: string
  nodeIds: string[]
  edgeId?: string
}

export interface StoryValidationResult {
  valid: boolean
  errors: StoryValidationError[]
}

export interface StoryPatchDiff {
  addedNodeIds: string[]
  updatedNodeIds: string[]
  removedNodeIds: string[]
  addedEdgeIds: string[]
  removedEdgeIds: string[]
}

function duplicates(values: string[]): Set<string> {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return repeated
}

export function validateStoryGraph(graph: StoryGraph): StoryValidationResult {
  const errors: StoryValidationError[] = []
  const nodeIds = new Set(graph.nodes.map((node) => node.id))

  for (const id of duplicates(graph.nodes.map((node) => node.id))) {
    errors.push({ code: 'duplicate-node-id', message: `节点 ID 重复: ${id}`, nodeIds: [id] })
  }
  for (const id of duplicates(graph.edges.map((edge) => edge.id))) {
    errors.push({ code: 'duplicate-edge-id', message: `连线 ID 重复: ${id}`, nodeIds: [], edgeId: id })
  }

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push({
        code: 'edge-reference-missing',
        message: `连线 ${edge.id} 引用了不存在的节点`,
        nodeIds: [edge.source, edge.target].filter((id) => nodeIds.has(id)),
        edgeId: edge.id,
      })
      continue
    }
    if (edge.sourceHandle?.startsWith('choice-')) {
      const source = graph.nodes.find((node) => node.id === edge.source)
      const index = Number(edge.sourceHandle.slice('choice-'.length))
      const choices = source?.type === 'choice' && Array.isArray(source.data.choices) ? source.data.choices : []
      if (!Number.isInteger(index) || index < 0 || index >= choices.length) {
        errors.push({
          code: 'choice-handle-invalid',
          message: `连线 ${edge.id} 的选项句柄无效`,
          nodeIds: [edge.source],
          edgeId: edge.id,
        })
      }
    }
  }
  return { valid: errors.length === 0, errors }
}

function cloneGraph(graph: StoryGraph): StoryGraph {
  return {
    nodes: graph.nodes.map((node) => ({ ...node, position: { ...node.position }, data: { ...node.data } })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  }
}

function proposedPosition(graph: StoryGraph, anchor?: { afterNodeId: string } | { beforeNodeId: string }): { x: number; y: number } {
  if (anchor && 'afterNodeId' in anchor) {
    const node = graph.nodes.find((candidate) => candidate.id === anchor.afterNodeId)
    if (node) return { x: node.position.x, y: node.position.y + 120 }
  }
  if (anchor && 'beforeNodeId' in anchor) {
    const node = graph.nodes.find((candidate) => candidate.id === anchor.beforeNodeId)
    if (node) return { x: node.position.x, y: node.position.y - 120 }
  }
  const maxY = graph.nodes.reduce((maximum, node) => Math.max(maximum, node.position.y), 0)
  return { x: 250, y: maxY + 120 }
}

export function applyStoryPatch(
  original: StoryGraph,
  candidate: StoryPatch,
  createId: () => string,
): { graph: StoryGraph; validation: StoryValidationResult } {
  const patch = storyPatchSchema.parse(candidate)
  const graph = cloneGraph(original)
  const temporaryIds = new Map<string, string>()
  const pendingEdges: Array<{ sourceRef: string; targetRef: string; sourceHandle?: string; label?: string }> = []
  let edgeSequence = 0

  for (const operation of patch.operations) {
    if (operation.kind === 'addNode') {
      const id = createId()
      if (temporaryIds.has(operation.tempId)) throw new Error(`临时节点 ID 重复: ${operation.tempId}`)
      temporaryIds.set(operation.tempId, id)
      const node: StoryNode = {
        id,
        type: operation.node.type,
        position: operation.node.position ?? proposedPosition(graph, operation.anchor),
        data: { ...operation.node.data },
      }
      graph.nodes.push(node)
      continue
    }
    if (operation.kind === 'updateNode') {
      const node = graph.nodes.find((candidateNode) => candidateNode.id === operation.nodeId)
      if (!node) throw new Error(`无法修改不存在的节点: ${operation.nodeId}`)
      node.data = { ...node.data, ...operation.changes }
      continue
    }
    if (operation.kind === 'removeNode') {
      if (!graph.nodes.some((node) => node.id === operation.nodeId)) throw new Error(`无法删除不存在的节点: ${operation.nodeId}`)
      graph.nodes = graph.nodes.filter((node) => node.id !== operation.nodeId)
      graph.edges = graph.edges.filter((edge) => edge.source !== operation.nodeId && edge.target !== operation.nodeId)
      continue
    }
    if (operation.kind === 'addEdge') {
      // A generated patch may declare its linking edge before the nodes it links.
      // Resolve temporary IDs after all add-node operations have been processed.
      pendingEdges.push({
        sourceRef: operation.sourceRef,
        targetRef: operation.targetRef,
        sourceHandle: operation.sourceHandle,
        label: operation.label,
      })
      continue
    }
    graph.edges = graph.edges.filter((edge) => edge.id !== operation.edgeId)
  }

  for (const pending of pendingEdges) {
    const source = temporaryIds.get(pending.sourceRef) ?? pending.sourceRef
    const target = temporaryIds.get(pending.targetRef) ?? pending.targetRef
    graph.edges.push({
      id: `agent-edge-${source}-${target}-${edgeSequence++}`,
      source,
      target,
      sourceHandle: pending.sourceHandle,
      label: pending.label,
      animated: true,
    })
  }

  return { graph, validation: validateStoryGraph(graph) }
}

function nodeSignature(node: StoryNode): string {
  return JSON.stringify({ type: node.type, position: node.position, data: node.data })
}

export function createStoryPatchDiff(before: StoryGraph, after: StoryGraph): StoryPatchDiff {
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]))
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]))
  const beforeEdgeIds = new Set(before.edges.map((edge) => edge.id))
  const afterEdgeIds = new Set(after.edges.map((edge) => edge.id))
  return {
    addedNodeIds: after.nodes.filter((node) => !beforeNodes.has(node.id)).map((node) => node.id),
    updatedNodeIds: after.nodes.filter((node) => {
      const previous = beforeNodes.get(node.id)
      return previous !== undefined && nodeSignature(previous) !== nodeSignature(node)
    }).map((node) => node.id),
    removedNodeIds: before.nodes.filter((node) => !afterNodes.has(node.id)).map((node) => node.id),
    addedEdgeIds: after.edges.filter((edge) => !beforeEdgeIds.has(edge.id)).map((edge) => edge.id),
    removedEdgeIds: before.edges.filter((edge) => !afterEdgeIds.has(edge.id)).map((edge) => edge.id),
  }
}
