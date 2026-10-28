import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { applyLibraryBackground } from './applyLibraryBackground'
const node = (id: string, type: string, group = 'scene'): Node => ({ id, type, position: { x: 200, y: 100 }, data: { sceneGroupId: group, text: id, voiceTracks: { ja: { url: '/keep.wav' } } } })
describe('library background handoff', () => {
  it('updates an existing entry without replacing dialogue, voice or stable node IDs', () => {
    const nodes = [node('bg', 'background'), node('line', 'dialogue')]
    const edges: Edge[] = [{ id: 'next', source: 'bg', target: 'line' }]
    const next = applyLibraryBackground(nodes, edges, 'scene', 'bg-cafe')
    expect(next.nodes[0].data.backgroundId).toBe('bg-cafe')
    expect(next.nodes[1]).toBe(nodes[1])
    expect(next.edges).toEqual(edges)
  })
  it('preserves independent choice branches when one logical scene has several entry points', () => {
    const nodes = [node('choice', 'choice', 'previous'), node('ending-a', 'dialogue'), node('ending-b', 'dialogue')]
    const edges: Edge[] = [{ id: 'a', source: 'choice', sourceHandle: 'choice-0', target: 'ending-a' }, { id: 'b', source: 'choice', sourceHandle: 'choice-1', target: 'ending-b' }]
    const next = applyLibraryBackground(nodes, edges, 'scene', 'bg-starry')
    const a = next.edges.find((edge) => edge.id === 'a')!, b = next.edges.find((edge) => edge.id === 'b')!
    expect(a.target).not.toBe(b.target)
    expect(a.sourceHandle).toBe('choice-0')
    expect(b.sourceHandle).toBe('choice-1')
    expect(next.edges.find((edge) => edge.source === a.target)?.target).toBe('ending-a')
    expect(next.edges.find((edge) => edge.source === b.target)?.target).toBe('ending-b')
    expect(nodes).toHaveLength(3)
  })
})
