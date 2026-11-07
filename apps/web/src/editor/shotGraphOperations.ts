import type { Edge, Node } from '@xyflow/react'
import { readLocalizationFields, voiceTextHash } from '@dreamchord/story-domain'
import { normalEdge, type ShotCard } from './sceneGraph'

export interface ShotCardEditOptions { removedChoiceIndex: number }

/** Rechain the scene in reading order, retaining each card's background and branch edges. */
export function moveShotCard(cards: ShotCard[], cardId: string, direction: 'up' | 'down', nodes: Node[], edges: Edge[]) {
  const index = cards.findIndex(card => card.id === cardId)
  const target = index + (direction === 'up' ? -1 : 1)
  if (index < 0 || target < 0 || target >= cards.length) return null
  const ordered = [...cards]
  const [moved] = ordered.splice(index, 1)
  ordered.splice(target, 0, moved!)
  const sceneIds = new Set(cards.flatMap(card => card.nodeIds))
  const byId = new Map(nodes.map(node => [node.id, node]))
  const usedIds = new Set(nodes.map(node => node.id))
  const usedBackgrounds = new Set<string>()
  const addedNodes: Node[] = []
  const sequence: Node[] = []
  let backgroundId: string | undefined
  for (const card of ordered) {
    const cardNodes = card.nodeIds.map(id => byId.get(id)).filter((node): node is Node => Boolean(node))
    const background = cardNodes.find(node => node.type === 'background')
    if (background && background.id !== backgroundId) {
      let next = background
      if (usedBackgrounds.has(background.id)) {
        // A shared background may need to resume after a card with a different one.
        let id = `${background.id}-for-${card.id}`
        while (usedIds.has(id)) id += '-copy'
        usedIds.add(id)
        next = { ...background, id, data: { ...background.data } }
        addedNodes.push(next)
      }
      sequence.push(next)
      usedBackgrounds.add(background.id)
      backgroundId = background.id
    }
    sequence.push(...cardNodes.filter(node => node.type !== 'background'))
  }
  const previousStart = cards[0]!.nodeIds[0]
  const previousTail = cards.at(-1)!.nodeIds.at(-1)
  const nextEdges = edges.flatMap(edge => {
    if (!edge.sourceHandle && sceneIds.has(edge.source) && sceneIds.has(edge.target)) return []
    if (!sceneIds.has(edge.source) && edge.target === previousStart) return [{ ...edge, target: sequence[0]!.id }]
    if (!edge.sourceHandle && edge.source === previousTail && !sceneIds.has(edge.target)) return [{ ...edge, source: sequence.at(-1)!.id }]
    return [edge]
  })
  for (let i = 0; i < sequence.length - 1; i++) {
    const source = sequence[i]!.id, targetId = sequence[i + 1]!.id
    nextEdges.push(edges.find(edge => !edge.sourceHandle && edge.source === source && edge.target === targetId) || normalEdge(source, targetId))
  }
  return { nodes: [...nodes, ...addedNodes], edges: nextEdges }
}

export function deleteShotCard(card: ShotCard, cards: ShotCard[], nodes: Node[], edges: Edge[]) {
  const otherIds = new Set(cards.filter(item => item.id !== card.id).flatMap(item => item.nodeIds))
  const deleted = new Set(card.nodeIds.filter(id => !otherIds.has(id)))
  const incoming = edges.filter(edge => !deleted.has(edge.source) && deleted.has(edge.target))
  const outgoing = edges.find(edge => deleted.has(edge.source) && !deleted.has(edge.target) && !edge.sourceHandle)
  const nextEdges = edges.filter(edge => !deleted.has(edge.source) && !deleted.has(edge.target))
  if (outgoing) nextEdges.push(...incoming.map(edge => ({ ...edge, target: outgoing.target })))
  return { nodes: nodes.filter(node => !deleted.has(node.id)), edges: nextEdges }
}

/** Remove an option, not its destination scene (which can have other incoming branches). */
export function removeShotChoice(nodeId: string, removedIndex: number, choices: string[], nodes: Node[], edges: Edge[]) {
  const nextNodes = nodes.map(node => {
    if (node.id !== nodeId) return node
    const { localizations } = readLocalizationFields(node.data)
    const originalChoices = Array.isArray(node.data.choices) ? node.data.choices : []
    for (const locale of ['zh', 'ja'] as const) {
      const translation = localizations?.[locale]
      if (!translation?.choices || translation.choices.length !== originalChoices.length) continue
      localizations![locale] = { ...translation, choices: translation.choices.filter((_, index) => index !== removedIndex),
        ...(translation.sourceHash === voiceTextHash(originalChoices.join('\n')) ? { sourceHash: voiceTextHash(choices.join('\n')) } : {}) }
    }
    return { ...node, data: { ...node.data, choices, ...(node.data.localizations ? { localizations } : {}) } }
  })
  const nextEdges = edges.flatMap(edge => {
    if (edge.source !== nodeId || !edge.sourceHandle?.startsWith('choice-')) return [edge]
    const index = Number(edge.sourceHandle.slice('choice-'.length))
    if (index === removedIndex) return []
    const nextIndex = index > removedIndex ? index - 1 : index
    return [{ ...edge, sourceHandle: `choice-${nextIndex}`, label: choices[nextIndex] ?? edge.label }]
  })
  return { nodes: nextNodes, edges: nextEdges }
}
