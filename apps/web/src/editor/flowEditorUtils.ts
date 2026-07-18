import { type Node, type Edge } from '@xyflow/react'
import { type FlowNode, type FlowEdge } from '../api/client'
import { safeJsonParse } from '../lib/safeJsonParse'
import { getNodeSceneCode, getNodeSceneGroupId, getNodeData } from './sceneGraph'

export const DEFAULT_SCENE_BACKGROUND_ID = 'bg-classroom'

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
  let groupedNodes = nodes
  if (!hasSceneGroups) {
    let sceneIndex = 1
    let groupId = 'legacy-scene-1'
    let groupHasText = false
    groupedNodes = nodes.map((node) => {
      if (node.type === 'background' && groupHasText) {
        sceneIndex += 1
        groupId = `legacy-scene-${sceneIndex}`
        groupHasText = false
      }
      const nextNode = { ...node, data: { ...getNodeData(node), sceneGroupId: groupId, sceneCode: `1-${sceneIndex}` } }
      if (node.type === 'dialogue' || node.type === 'subtitle' || node.type === 'choice') groupHasText = true
      return nextNode
    })
  }

  const usedSceneNumbers = new Set(groupedNodes.flatMap((node) => {
    const match = /^(\d+)-(\d+)$/.exec(getNodeSceneCode(node))
    return match && match[1] === '1' ? [Number(match[2])] : []
  }))
  const replacements = new Map<string, string>()
  let candidate = 1
  for (const node of groupedNodes) {
    const groupId = getNodeSceneGroupId(node)
    if (!groupId || /^(\d+)-(\d+)$/.test(getNodeSceneCode(node)) || replacements.has(groupId)) continue
    while (usedSceneNumbers.has(candidate)) candidate += 1
    replacements.set(groupId, `1-${candidate}`)
    usedSceneNumbers.add(candidate)
  }
  if (replacements.size === 0) return groupedNodes
  return groupedNodes.map((node) => {
    const replacement = replacements.get(getNodeSceneGroupId(node))
    if (!replacement) return node
    const data = getNodeData(node)
    const title = typeof data.sceneTitle === 'string' ? data.sceneTitle.trim() : ''
    return {
      ...node,
      data: {
        ...data,
        sceneCode: replacement,
        ...(title === '' || title === 'Agent 新建场景' ? { sceneTitle: `Agent 场景 ${replacement}` } : {}),
      },
    }
  })
}
