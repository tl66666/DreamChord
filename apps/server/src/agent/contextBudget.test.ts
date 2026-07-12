import { describe, expect, it } from 'vitest'
import { selectContextSources } from './contextBudget.js'

describe('context budget', () => {
  it('keeps current task and story bible before lower-ranked history', () => {
    const selected = selectContextSources([
      { id: 'old', kind: 'history', content: '旧消息'.repeat(20), priority: 5, score: 10 },
      { id: 'bible', kind: 'story-bible', content: '故事圣经'.repeat(8), priority: 1, score: 100 },
      { id: 'task', kind: 'task', content: '当前任务'.repeat(8), priority: 0, score: 100 },
    ], 100)
    expect(selected.sources.map((item) => item.id)).toEqual(['task', 'bible'])
    expect(selected.omittedIds).toContain('old')
    expect(selected.usedCharacters).toBeLessThanOrEqual(100)
  })
})
