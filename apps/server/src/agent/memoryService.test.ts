import { describe, expect, it } from 'vitest'
import { rankMemories, type RankableMemory } from './memoryService.js'

const now = new Date('2026-07-12T00:00:00.000Z')
function memory(patch: Partial<RankableMemory>): RankableMemory {
  return {
    id: crypto.randomUUID(), kind: 'canon', title: '记忆', content: '雪害怕被遗忘', tags: ['雪'], importance: 50,
    status: 'active', isPinned: false, sourceType: 'assistant', conversationId: null, supersededById: null, updatedAt: now,
    ...patch,
  }
}

describe('memory ranking', () => {
  it('prioritizes pinned authoritative and relevant memories', () => {
    const ranked = rankMemories([
      memory({ id: 'recent', content: '咖啡店天气晴朗', updatedAt: new Date('2026-07-12T00:00:00Z') }),
      memory({ id: 'canon', content: '雪害怕被故事遗忘', isPinned: true, sourceType: 'story-bible', updatedAt: new Date('2026-01-01T00:00:00Z') }),
    ], { query: '续写雪关于遗忘的冲突', conversationId: 'conversation', now })
    expect(ranked[0]?.memory.id).toBe('canon')
    expect(ranked[0]?.reasons).toContain('固定记忆')
  })

  it('excludes forgotten, superseded, and other-conversation records', () => {
    const ranked = rankMemories([
      memory({ id: 'forgotten', status: 'forgotten' }),
      memory({ id: 'superseded', supersededById: 'newer' }),
      memory({ id: 'other', conversationId: 'other-conversation' }),
      memory({ id: 'project-memory', conversationId: null }),
      memory({ id: 'current', conversationId: 'conversation' }),
    ], { query: '雪', conversationId: 'conversation', now })
    expect(ranked.map((item) => item.memory.id)).toEqual(expect.arrayContaining(['project-memory', 'current']))
    expect(ranked.map((item) => item.memory.id)).not.toEqual(expect.arrayContaining(['forgotten', 'superseded', 'other']))
  })
})
