import { describe, expect, it } from 'vitest'
import { chapterStartId, mergeChaptersForPreview } from './chapterPreview'
import { convertFlowToRuntime } from '../engine/converter'
import type { ProjectDetail } from '../api/client'
import { PAINT_PROLOGUE, PAINT_CHAPTER_ONE } from '@dreamchord/story-domain'
import { createRuntimeEngine } from '../engine/runtime'

const chapter = (id: string, order: number) => ({ id, order, title: id, version: 1, nodes: [
  { id: id + '-db-bg', nodeId: 'bg', type: 'background', positionX: 0, positionY: 0, data: JSON.stringify({ backgroundId: `/assets/${id}.webp` }) },
  { id: id + '-db-line', nodeId: 'line', type: 'subtitle', positionX: 0, positionY: 1, data: JSON.stringify({ text: id, audio: { bgm: { action: 'play', url: `/assets/${id}.ogg`, volume: .5 } } }) },
], edges: [{ id: id + '-db-e', edgeId: 'e', source: 'bg', target: 'line', label: null, sourceHandle: null, animated: true }] })
const project = { id: 'book', title: 'book', chapters: [chapter('one', 1), chapter('zero', 0)], characters: [] } as unknown as ProjectDetail
describe('chapter entry', () => {
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
  it.each([[0, 0], [0, 1], [1, 0], [1, 1]])('reads both complete chapters on choice route %s/%s', (first, second) => {
    const chapters = [PAINT_PROLOGUE, PAINT_CHAPTER_ONE].map((definition, order) => ({
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
      if (route.length > 350) throw new Error('Unexpected loop')
      if (scene.choices?.length) engine.choose([first, second][choices++])
      else engine.next()
    }
    expect(choices).toBe(2)
    expect(route).toContain('chapter-0:p-ending')
    expect(route).toContain('chapter-1:pc1-night-return')
    expect(route).toContain('chapter-1:pc1-cup-evidence')
    expect(route.at(-1)).toBe('chapter-1:pc1-ending')
    expect(route.includes('chapter-1:pc1-plan-1')).toBe(second === 1)
    expect(route.includes('chapter-1:pc1-cup-1')).toBe(second === 0)
  })
})
