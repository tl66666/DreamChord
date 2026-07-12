import { describe, expect, it } from 'vitest'
import { analyzeStoryGraph, OFFICIAL_DEMO } from './index.js'

describe('official demo graph', () => {
  it('contains nine named and connected scenes', () => {
    const groups = new Set(OFFICIAL_DEMO.graph.nodes.map((node) => node.data.sceneGroupId))
    expect(groups.size).toBe(9)
    expect(OFFICIAL_DEMO.graph.nodes.every((node) => typeof node.data.sceneTitle === 'string' && node.data.sceneTitle.trim())).toBe(true)
    const nodeIds = new Set(OFFICIAL_DEMO.graph.nodes.map((node) => node.id))
    expect(OFFICIAL_DEMO.graph.edges.every((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))).toBe(true)
    expect(analyzeStoryGraph(OFFICIAL_DEMO.graph).issues.filter((issue) => issue.level === 'danger')).toEqual([])
  })

  it('gives every three-way choice an explicit destination handle', () => {
    const choices = OFFICIAL_DEMO.graph.nodes.filter((node) => node.type === 'choice')
    expect(choices.length).toBeGreaterThanOrEqual(2)
    for (const choice of choices) {
      const expected = (choice.data.choices as string[]).map((_, index) => `choice-${index}`)
      const actual = OFFICIAL_DEMO.graph.edges.filter((edge) => edge.source === choice.id).map((edge) => edge.sourceHandle).sort()
      expect(actual).toEqual(expected)
    }
  })
})
