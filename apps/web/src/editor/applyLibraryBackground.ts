import type { Edge, Node } from '@xyflow/react'

/** Keep every incoming branch attached to its original scene entry. Never merge endings. */
export function applyLibraryBackground(nodes: Node[], edges: Edge[], sceneId: string, backgroundId: string) {
  const sceneNodes = nodes.filter((node) => node.data.sceneGroupId === sceneId)
  if (!sceneNodes.length) throw new Error('请先选择一个有效场景。')
  const ids = new Set(sceneNodes.map((node) => node.id))
  const entries = sceneNodes.filter((node) => edges.some((edge) => edge.target === node.id && !ids.has(edge.source)) || !edges.some((edge) => edge.target === node.id))
  if (!entries.length) throw new Error('这个场景没有明确入口，请先在流程图中检查连线。')
  let nextNodes = [...nodes], nextEdges = [...edges]
  for (const entry of entries) {
    if (entry.type === 'background') {
      nextNodes = nextNodes.map((node) => node.id === entry.id ? { ...node, data: { ...node.data, backgroundId } } : node)
      continue
    }
    let id = `${entry.id}-library-background`
    while (nextNodes.some((node) => node.id === id)) id += '-next'
    const inserted: Node = { id, type: 'background', position: { x: entry.position.x - 100, y: entry.position.y }, data: { backgroundId, sceneGroupId: sceneId, sceneCode: entry.data.sceneCode, sceneTitle: entry.data.sceneTitle } }
    const before = nextNodes.findIndex((node) => node.id === entry.id)
    nextNodes.splice(before, 0, inserted)
    nextEdges = nextEdges.map((edge) => edge.target === entry.id && !ids.has(edge.source) ? { ...edge, target: id } : edge)
    nextEdges.push({ id: `${id}-to-entry`, source: id, target: entry.id, animated: true })
  }
  return { nodes: nextNodes, edges: nextEdges }
}
