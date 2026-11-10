import { describe, expect, it } from 'vitest'
import { chapterStartId, mergeChaptersForPreview } from './chapterPreview'
import { convertFlowToRuntime } from '../engine/converter'
import type { ProjectDetail } from '../api/client'
import { PAINT_PROLOGUE, PAINT_CHAPTER_ONE, PAINT_CHAPTER_TWO, PAINT_CHAPTER_THREE, PAINT_CHAPTER_FOUR, PAINT_CHAPTER_FIVE } from '@dreamchord/story-domain'
import { createRuntimeEngine } from '../engine/runtime'

const chapter = (id: string, order: number) => ({ id, order, title: id, version: 1, nodes: [
  { id: id + '-db-bg', nodeId: 'bg', type: 'background', positionX: 0, positionY: 0, data: JSON.stringify({ backgroundId: `/assets/${id}.webp` }) },
  { id: id + '-db-line', nodeId: 'line', type: 'subtitle', positionX: 0, positionY: 1, data: JSON.stringify({ text: id, audio: { bgm: { action: 'play', url: `/assets/${id}.ogg`, volume: .5 } } }) },
], edges: [{ id: id + '-db-e', edgeId: 'e', source: 'bg', target: 'line', label: null, sourceHandle: null, animated: true }] })
const project = { id: 'book', title: 'book', chapters: [chapter('one', 1), chapter('zero', 0)], characters: [] } as unknown as ProjectDetail
describe('chapter entry', () => {
  it.each([['稿页', 'paper'], ['明信片', 'card']])('carries the %s choice across chapter boundaries', (_label, value) => {
    const makeNode = (id: string, type: string, data: Record<string, unknown>) => ({ id, nodeId: id, type, positionX: 0, positionY: 0, data: JSON.stringify(data) })
    const makeEdge = (source: string, target: string, sourceHandle: string | null = null) => ({ id: `${source}-${target}-${sourceHandle}`, edgeId: `${source}-${target}-${sourceHandle}`, source, target, sourceHandle, label: null, animated: true })
    const first = { ...chapter('first', 0), nodes: [
      makeNode('pick', 'choice', { choices: ['留下', '去河边'], effects: [[{ kind: 'setVariable', variable: 'keepsake', value: 'paper' }], [{ kind: 'setVariable', variable: 'keepsake', value: 'card' }]] }),
      makeNode('common', 'subtitle', { text: '次日' }),
    ], edges: [makeEdge('pick', 'common', 'choice-0'), makeEdge('pick', 'common', 'choice-1')] }
    const second = { ...chapter('second', 1), nodes: [
      makeNode('gate', 'condition', { variable: 'keepsake', operator: '==', value: 'paper' }),
      makeNode('paper', 'subtitle', { text: '他带来了稿页。' }),
      makeNode('card', 'subtitle', { text: '他带来了明信片。' }),
    ], edges: [makeEdge('gate', 'paper', 'true'), makeEdge('gate', 'card', 'false')] }
    const graph = mergeChaptersForPreview({ ...project, chapters: [first, second] } as ProjectDetail)
    const engine = createRuntimeEngine(convertFlowToRuntime('book', 'book', graph.nodes, graph.edges, []))
    expect(engine.currentScene()?.id).toBe('first:pick')
    engine.choose(value === 'paper' ? 0 : 1)
    expect(engine.currentScene()?.id).toBe('first:common')
    engine.next()
    expect(engine.currentScene()?.id).toBe(`second:${value}`)
  })
  it('does not carry the previous chapter actors into the next chapter before their entrance', () => {
    const zero = chapter('zero', 0), one = chapter('one', 1)
    zero.nodes.splice(1, 0, { id: 'zero-db-actor', nodeId: 'actor', type: 'character', positionX: 0, positionY: 0, data: JSON.stringify({ characterId: 'yuki', action: 'show', position: 'center' }) })
    zero.edges = [
      { id: 'za', edgeId: 'za', source: 'bg', target: 'actor', label: null, sourceHandle: null, animated: true },
      { id: 'zb', edgeId: 'zb', source: 'actor', target: 'line', label: null, sourceHandle: null, animated: true },
    ]
    const combined = mergeChaptersForPreview({ ...project, chapters: [zero, one] })
    const story = convertFlowToRuntime('book', 'book', combined.nodes, combined.edges, [])
    expect(story.scenes.find(s => s.id === 'zero:line')?.characters).toHaveLength(1)
    expect(story.scenes.find(s => s.id === 'one:line')?.characters).toEqual([])
    expect(story.scenes.find(s => s.id === 'one:line')?.background).toBe('/assets/one.webp')
  })
  it('sorts chapters, namespaces repeated node IDs, joins terminals and preserves the chapter stage', () => {
    const { nodes, edges } = mergeChaptersForPreview(project)
    expect(nodes[0].id).toBe('zero:bg')
    expect(edges.some(e => e.source === 'zero:line' && e.target === 'one:bg')).toBe(true)
    const story = convertFlowToRuntime('book', 'book', nodes, edges, [])
    const id = chapterStartId(story, project.chapters, '?chapter=1')
    expect(id).toBe('one:line')
    expect(story.scenes.find(s => s.id === id)?.background).toBe('/assets/one.webp')
    expect(story.scenes.find(s => s.id === id)?.audio?.bgm?.url).toBe('/assets/one.ogg')
    for (const query of ['', '?chapter=-1', '?chapter=9', '?chapter=1.5', '?chapter=garbage']) expect(chapterStartId(story, project.chapters, query)).toBeNull()
  })
  it.each(Array.from({ length: 64 }, (_, mask) => [mask >> 5 & 1, mask >> 4 & 1, mask >> 3 & 1, mask >> 2 & 1, mask >> 1 & 1, mask & 1]))('reads all six chapters on choice route %s/%s/%s/%s/%s/%s', (first, second, third, fourth, fifth, sixth) => {
    const chapters = [PAINT_PROLOGUE, PAINT_CHAPTER_ONE, PAINT_CHAPTER_TWO, PAINT_CHAPTER_THREE, PAINT_CHAPTER_FOUR, PAINT_CHAPTER_FIVE].map((definition, order) => ({
      id: `chapter-${order}`, order, title: definition.chapterTitle, version: 1,
      nodes: definition.graph.nodes.map(n => ({ id: n.id, nodeId: n.id, type: n.type, positionX: n.position.x, positionY: n.position.y, data: JSON.stringify(n.data) })),
      edges: definition.graph.edges.map(e => ({ ...e, edgeId: e.id, sourceHandle: e.sourceHandle ?? null, label: e.label ?? null })),
    }))
    const graph = mergeChaptersForPreview({ ...project, chapters })
    const engine = createRuntimeEngine(convertFlowToRuntime('book', 'book', graph.nodes, graph.edges, []))
    const route: string[] = []
    let choices = 0
    while (engine.currentScene()) {
      const scene = engine.currentScene()!
      route.push(scene.id)
      if (route.length > 800) throw new Error('Unexpected loop: ' + route.slice(-8).join(','))
      if (scene.choices?.length) engine.choose([first, second, third, fourth, fifth, sixth][choices++])
      else engine.next()
    }
    expect(choices).toBe(6)
    expect(route).toContain('chapter-0:p-ending')
    expect(route).toContain('chapter-1:pc1-night-return')
    expect(route).toContain('chapter-1:pc1-cup-evidence')
    expect(route).toContain('chapter-2:pc2-door-work')
    expect(route).toContain('chapter-2:pc2-read-7')
    expect(route).toContain('chapter-2:pc2-paper-4')
    expect(route).toContain('chapter-2:pc2-ending')
    expect(route).toContain('chapter-3:pc3-june-entry')
    expect(route).toContain('chapter-3:pc3-ending')
    expect(route).toContain('chapter-4:pc4-rehearsal-merge')
    expect(route).toContain('chapter-4:pc4-ending')
    expect(route.at(-1)).toBe('chapter-5:pc5-ending')
    expect(route.includes('chapter-5:pc5-paper-consequence')).toBe(sixth === 0)
    expect(route.includes('chapter-5:pc5-card-consequence')).toBe(sixth === 1)
    expect(route.includes('chapter-1:pc1-plan-1')).toBe(second === 1)
    expect(route.includes('chapter-1:pc1-cup-1')).toBe(second === 0)
    expect(route.includes('chapter-2:pc2-a-1')).toBe(third === 0)
    expect(route.includes('chapter-2:pc2-b-1')).toBe(third === 1)
    expect(route.includes('chapter-3:pc3-photo-1')).toBe(fourth === 0)
    expect(route.includes('chapter-3:pc3-journal-1')).toBe(fourth === 1)
    expect(route.includes('chapter-4:pc4-table-under')).toBe(fifth === 0)
    expect(route.includes('chapter-4:pc4-read-swap')).toBe(fifth === 1)
  })
})
