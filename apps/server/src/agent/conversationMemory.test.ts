import { describe, expect, it } from 'vitest'
import { buildRollingSummary, createConversationSources } from './conversationMemory.js'

describe('conversation memory context', () => {
  it('builds bounded sources from active memory, recent turns, and a rolling summary', () => {
    const sources = createConversationSources({
      summary: '此前已确定故事发生在冬夜。',
      messages: [
        { id: 'old', role: 'user', content: '旧问题', createdAt: new Date('2026-07-10') },
        { id: 'recent', role: 'assistant', content: '雪决定推开门。', createdAt: new Date('2026-07-12') },
      ],
      memories: [{ id: 'memory', kind: 'plot', title: '门后真相', content: '门后是废弃车站', tags: [], importance: 90, status: 'active', isPinned: true, sourceType: 'user', conversationId: null, supersededById: null, updatedAt: new Date('2026-07-12') }],
      query: '续写雪推开门', conversationId: 'conversation', characterBudget: 2_000,
    })
    expect(sources.map((source) => source.kind)).toEqual(expect.arrayContaining(['conversation-history', 'memory', 'conversation-summary']))
    expect(JSON.stringify(sources)).toContain('废弃车站')
  })

  it('summarizes only older turns while preserving speaker attribution', () => {
    const messages = Array.from({ length: 25 }, (_, index) => ({ id: `m${index}`, role: index % 2 ? 'assistant' : 'user', content: `第${index}条消息`, createdAt: new Date() }))
    const result = buildRollingSummary(messages, 12, 2_000)
    expect(result?.throughMessageId).toBe('m12')
    expect(result?.summary).toContain('用户：第0条消息')
    expect(result?.summary).not.toContain('第24条消息')
  })
})
