import { describe, expect, it } from 'vitest'
import { analyzeStoryGraph, type StoryGraph } from './index.js'

describe('analyzeStoryGraph', () => {
  it('reports every option without a choice edge', () => {
    const graph: StoryGraph = {
      nodes: [{
        id: 'choice-1',
        type: 'choice',
        position: { x: 0, y: 0 },
        data: { choices: ['留下', '离开'], sceneGroupId: 'scene-1' },
      }],
      edges: [],
    }

    const report = analyzeStoryGraph(graph)

    expect(report.issues.filter((issue) => issue.code === 'choice-exit-missing')).toHaveLength(2)
  })

  it('reports nodes unreachable from the single start node', () => {
    const graph: StoryGraph = {
      nodes: [
        { id: 'start', type: 'subtitle', position: { x: 0, y: 0 }, data: { text: '开始' } },
        { id: 'end', type: 'subtitle', position: { x: 0, y: 100 }, data: { text: '结束' } },
        { id: 'lost', type: 'dialogue', position: { x: 300, y: 0 }, data: { role: '雪', text: '无人听见' } },
      ],
      edges: [{ id: 'e1', source: 'start', target: 'end', animated: true }],
    }

    const report = analyzeStoryGraph(graph)

    expect(report.issues.some((issue) => issue.code === 'node-unreachable' && issue.nodeIds.includes('lost'))).toBe(true)
  })

  it('reports invalid edges and empty playable text', () => {
    const graph: StoryGraph = {
      nodes: [{ id: 'line', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: '雪', text: '  ' } }],
      edges: [{ id: 'bad', source: 'line', target: 'missing', animated: true }],
    }

    const report = analyzeStoryGraph(graph)

    expect(report.issues.some((issue) => issue.code === 'invalid-edge')).toBe(true)
    expect(report.issues.some((issue) => issue.code === 'empty-text' && issue.nodeIds.includes('line'))).toBe(true)
  })

  it('reports branches that immediately converge without distinct content', () => {
    const graph: StoryGraph = {
      nodes: [
        { id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: { choices: ['A', 'B'] } },
        { id: 'merge', type: 'subtitle', position: { x: 0, y: 100 }, data: { text: '汇合' } },
      ],
      edges: [
        { id: 'a', source: 'choice', target: 'merge', sourceHandle: 'choice-0', animated: true },
        { id: 'b', source: 'choice', target: 'merge', sourceHandle: 'choice-1', animated: true },
      ],
    }

    const report = analyzeStoryGraph(graph)

    expect(report.issues.some((issue) => issue.code === 'shallow-branch')).toBe(true)
  })
})
