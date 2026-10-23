import { describe, expect, it } from 'vitest'
import { analyzeStoryGraph, OFFICIAL_DEMO } from './index.js'

describe('official demo graph', () => {
  it('contains nine named and connected scenes', () => {
    const groups = new Set(OFFICIAL_DEMO.graph.nodes.map((node) => node.data.sceneGroupId))
    expect(groups.size).toBe(9)
    expect([...new Set(OFFICIAL_DEMO.graph.nodes.map((node) => node.data.sceneCode))].sort()).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9'])
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

  it('keeps the final choice on three distinct routes with separate endings', () => {
    const finalChoice = OFFICIAL_DEMO.graph.nodes.find((node) => node.id === 's8-choice')
    expect(finalChoice).toBeDefined()

    const routes = ['choice-0', 'choice-1', 'choice-2'].map((handle) => {
      const firstEdge = OFFICIAL_DEMO.graph.edges.find((edge) => edge.source === finalChoice?.id && edge.sourceHandle === handle)
      expect(firstEdge).toBeDefined()
      const route: string[] = []
      let current = firstEdge!.target
      while (current) {
        expect(route).not.toContain(current)
        route.push(current)
        current = OFFICIAL_DEMO.graph.edges.find((edge) => edge.source === current)?.target || ''
      }
      return route
    })

    expect(new Set(routes.map((route) => route.at(-1))).size).toBe(3)
    expect(routes.every((route) => route.length >= 6)).toBe(true)
    expect(routes[0]!.some((id) => id.startsWith('ending-failure-'))).toBe(true)
    expect(routes[1]!.some((id) => id.startsWith('ending-coauthor-'))).toBe(true)
    expect(routes[2]!.some((id) => id.startsWith('ending-agency-'))).toBe(true)

    for (let left = 0; left < routes.length; left += 1) {
      for (let right = left + 1; right < routes.length; right += 1) {
        expect(routes[left]!.filter((id) => routes[right]!.includes(id))).toEqual([])
      }
    }
  })
})
