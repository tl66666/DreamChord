import { describe, expect, it } from 'vitest'
import {
  applyStoryPatch,
  createStoryPatchDiff,
  storyPatchSchema,
  validateStoryGraph,
  type StoryGraph,
} from './index.js'

const baseGraph: StoryGraph = {
  nodes: [{ id: 'start', type: 'subtitle', position: { x: 0, y: 0 }, data: { text: '开始' } }],
  edges: [],
}

describe('story patches', () => {
  it('adds a node and resolves its temporary edge reference', () => {
    const result = applyStoryPatch(baseGraph, {
      operations: [
        {
          kind: 'addNode',
          tempId: 'new-line',
          node: { type: 'dialogue', data: { role: '雪', text: '继续。' } },
          anchor: { afterNodeId: 'start' },
        },
        { kind: 'addEdge', sourceRef: 'start', targetRef: 'new-line' },
      ],
    }, () => 'generated-node')

    expect(result.graph.nodes.some((node) => node.id === 'generated-node')).toBe(true)
    expect(result.graph.edges.some((edge) => edge.source === 'start' && edge.target === 'generated-node')).toBe(true)
  })

  it('resolves an edge to a temporary node even when the edge appears before the node operation', () => {
    let sequence = 0
    const result = applyStoryPatch(baseGraph, {
      operations: [
        { kind: 'addEdge', sourceRef: 'start', targetRef: 'new-scene' },
        { kind: 'addNode', tempId: 'new-scene', node: { type: 'background', data: { backgroundId: 'bg-sakura' } } },
      ],
    }, () => `generated-${sequence++}`)

    expect(result.validation).toEqual({ valid: true, errors: [] })
    expect(result.graph.edges).toContainEqual(expect.objectContaining({ source: 'start', target: 'generated-0' }))
  })

  it('rejects a choice edge whose handle exceeds the choice count', () => {
    const result = validateStoryGraph({
      nodes: [{ id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: { choices: ['A'] } }],
      edges: [{ id: 'bad', source: 'choice', target: 'choice', sourceHandle: 'choice-2', animated: true }],
    })

    expect(result.errors.some((error) => error.code === 'choice-handle-invalid')).toBe(true)
  })

  it('removes incident edges when removing a node', () => {
    const graph: StoryGraph = {
      nodes: [
        ...baseGraph.nodes,
        { id: 'end', type: 'subtitle', position: { x: 0, y: 100 }, data: { text: '结束' } },
      ],
      edges: [{ id: 'edge', source: 'start', target: 'end', animated: true }],
    }

    const result = applyStoryPatch(graph, { operations: [{ kind: 'removeNode', nodeId: 'end' }] }, () => 'unused')

    expect(result.graph.nodes.map((node) => node.id)).toEqual(['start'])
    expect(result.graph.edges).toEqual([])
  })

  it('rejects unknown node data fields', () => {
    const parsed = storyPatchSchema.safeParse({
      operations: [{
        kind: 'addNode',
        tempId: 'bad',
        node: { type: 'dialogue', data: { role: '雪', text: '你好', executeCode: true } },
      }],
    })

    expect(parsed.success).toBe(false)
  })

  it('creates a stable graph diff', () => {
    const result = applyStoryPatch(baseGraph, {
      operations: [
        { kind: 'updateNode', nodeId: 'start', changes: { text: '新的开始' } },
        { kind: 'addNode', tempId: 'end', node: { type: 'subtitle', data: { text: '结束' } } },
      ],
    }, () => 'end')

    expect(createStoryPatchDiff(baseGraph, result.graph)).toEqual({
      addedNodeIds: ['end'],
      updatedNodeIds: ['start'],
      removedNodeIds: [],
      addedEdgeIds: [],
      removedEdgeIds: [],
    })
  })
})
