import { type Node, type Edge } from '@xyflow/react'
import { type FlowNode, type FlowEdge } from '../api/client'
import { safeJsonParse } from '../lib/safeJsonParse'
import { getNodeSceneGroupId, getNodeData } from './sceneGraph'

export function getApiError(err: unknown, fallback = '操作失败'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    return response?.data?.error || fallback
  }
  return err instanceof Error ? err.message || fallback : fallback
}

export function convertServerNodes(nodes: FlowNode[]): Node[] {
  return nodes.map((n) => ({ id: n.nodeId, type: n.type, position: { x: n.positionX, y: n.positionY }, data: safeJsonParse<Record<string, unknown>>(n.data, {}) }))
}
export function convertServerEdges(edges: FlowEdge[]): Edge[] {
  return edges.map((e) => ({ id: e.edgeId, source: e.source, target: e.target, label: e.label || undefined, sourceHandle: e.sourceHandle || undefined, animated: e.animated }))
}


export function ensureLegacySceneGroups(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes
  const hasSceneGroups = nodes.some((node) => Boolean(getNodeSceneGroupId(node)))
  if (hasSceneGroups) return nodes

  let sceneIndex = 1
  let groupId = `legacy-scene-1`
  let groupHasText = false

  return nodes.map((node) => {
    if (node.type === 'background' && groupHasText) {
      sceneIndex += 1
      groupId = `legacy-scene-${sceneIndex}`
      groupHasText = false
    }

    const sceneCode = `1-${sceneIndex}`
    const nextNode = {
      ...node,
      data: {
        ...getNodeData(node),
        sceneGroupId: groupId,
        sceneCode,
      },
    }

    if (node.type === 'dialogue' || node.type === 'subtitle' || node.type === 'choice') {
      groupHasText = true
    }

    return nextNode
  })
}
