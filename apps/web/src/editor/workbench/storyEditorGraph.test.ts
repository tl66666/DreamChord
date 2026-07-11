import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { createOpeningTemplateGraph, removeChoiceBranchFromGraph } from './storyEditorGraph'

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
})
