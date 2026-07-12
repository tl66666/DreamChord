import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import {
  createInheritedSceneDraft,
  createOpeningTemplateGraph,
  createSceneNodes,
  removeChoiceBranchFromGraph,
  resolveStageStateAfterNode,
} from './storyEditorGraph'

describe('story editor graph actions', () => {
  it('removes a choice branch and renumbers later handles', () => {
    const choice: Node = { id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: { choices: ['A', 'B', 'C'] } }
    const nodes: Node[] = [choice, ...['a', 'b', 'c'].map((id) => ({ id, type: 'dialogue', position: { x: 0, y: 0 }, data: {} }))]
    const edges: Edge[] = ['a', 'b', 'c'].map((target, index) => ({ id: `edge-${index}`, source: 'choice', target, sourceHandle: `choice-${index}`, animated: true }))
    const result = removeChoiceBranchFromGraph(choice, 1, nodes, edges)

    expect(result.nodes.map((node) => node.id)).toEqual(['choice', 'a', 'c'])
    expect(result.nodes[0].data.choices).toEqual(['A', 'C'])
    expect(result.edges.map((edge) => edge.sourceHandle)).toEqual(['choice-0', 'choice-1'])
    expect(result.edges[1].label).toBe('C')
  })

  it('creates an opening with two connected branches', () => {
    const result = createOpeningTemplateGraph(100)
    const choice = result.nodes.find((node) => node.type === 'choice')
    const branchEdges = result.edges.filter((edge) => edge.source === choice?.id)
    expect(branchEdges.map((edge) => edge.sourceHandle)).toEqual(['choice-0', 'choice-1'])
    expect(branchEdges.every((edge) => result.nodes.some((node) => node.id === edge.target))).toBe(true)
  })

  it('inherits the effective background and on-stage characters into the next scene', () => {
    const nodes: Node[] = [
      { id: 'bg', type: 'background', position: { x: 0, y: 0 }, data: { backgroundId: '/room.png' } },
      { id: 'yuki', type: 'character', position: { x: 0, y: 0 }, data: { characterId: 'yuki', action: 'show', expression: 'smile', position: 'left' } },
      { id: 'line', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: 'yuki', text: '你来了。' } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'bg', target: 'yuki' },
      { id: 'e2', source: 'yuki', target: 'line' },
    ]

    const stage = resolveStageStateAfterNode(nodes, edges, 'line')
    const draft = createInheritedSceneDraft(stage)

    expect(stage.backgroundId).toBe('/room.png')
    expect(stage.characters).toEqual([{ characterId: 'yuki', expression: 'smile', position: 'left', action: 'keep' }])
    expect(draft.backgroundId).toBe('/room.png')
    expect(draft.characters[0]?.action).toBe('keep')
  })

  it('keeps previous characters while emitting only a new character entrance', () => {
    const sceneNodes = createSceneNodes({
      ...createInheritedSceneDraft({
        backgroundId: '/room.png',
        characters: [{ characterId: 'yuki', expression: 'normal', position: 'left', action: 'keep' }],
        ambiguous: false,
        conflicts: [],
      }),
      autoStageSpeaker: false,
      speakerRole: 'ren',
      text: '我也到了。',
      characters: [
        { characterId: 'yuki', expression: 'normal', position: 'left', action: 'keep' },
        { characterId: 'ren', expression: 'serious', position: 'right', action: 'show' },
      ],
    })

    const characterNodes = sceneNodes.filter((node) => node.type === 'character')
    expect(characterNodes).toHaveLength(1)
    expect(characterNodes[0]?.data).toMatchObject({ characterId: 'ren', action: 'show' })
  })

  it('emits an explicit hide event when an inherited character leaves', () => {
    const sceneNodes = createSceneNodes({
      ...createInheritedSceneDraft({
        backgroundId: '/room.png',
        characters: [{ characterId: 'yuki', expression: 'normal', position: 'left', action: 'keep' }],
        ambiguous: false,
        conflicts: [],
      }),
      autoStageSpeaker: false,
      text: '雪离开了房间。',
      characters: [{ characterId: 'yuki', expression: 'normal', position: 'left', action: 'hide' }],
    })

    expect(sceneNodes.find((node) => node.type === 'character')?.data).toMatchObject({ characterId: 'yuki', action: 'hide' })
  })

  it('marks divergent branch stages as ambiguous at a merge', () => {
    const nodes: Node[] = [
      { id: 'start', type: 'character', position: { x: 0, y: 0 }, data: { characterId: 'yuki', action: 'show', expression: 'normal', position: 'left' } },
      { id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: { choices: ['留下', '离开'] } },
      { id: 'stay', type: 'character', position: { x: 0, y: 0 }, data: { characterId: 'ren', action: 'show', expression: 'normal', position: 'right' } },
      { id: 'leave', type: 'character', position: { x: 0, y: 0 }, data: { characterId: 'yuki', action: 'hide', expression: 'normal', position: 'left' } },
      { id: 'merge', type: 'subtitle', position: { x: 0, y: 0 }, data: { text: '两条路再次交汇。' } },
    ]
    const edges: Edge[] = [
      { id: 's-c', source: 'start', target: 'choice' },
      { id: 'c-a', source: 'choice', target: 'stay', sourceHandle: 'choice-0' },
      { id: 'c-b', source: 'choice', target: 'leave', sourceHandle: 'choice-1' },
      { id: 'a-m', source: 'stay', target: 'merge' },
      { id: 'b-m', source: 'leave', target: 'merge' },
    ]

    const stage = resolveStageStateAfterNode(nodes, edges, 'merge')

    expect(stage.ambiguous).toBe(true)
    expect(stage.conflicts.join('')).toContain('角色')
  })
})
