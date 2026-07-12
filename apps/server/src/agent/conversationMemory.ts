import type { AgentContextSource } from './context.js'
import { selectContextSources } from './contextBudget.js'
import { rankMemories, type RankableMemory } from './memoryService.js'

export interface ConversationMessage {
  id: string
  role: string
  content: string
  createdAt: Date
}

export function createConversationSources(input: {
  summary: string
  messages: ConversationMessage[]
  memories: RankableMemory[]
  query: string
  conversationId: string
  characterBudget?: number
}): AgentContextSource[] {
  const ranked = rankMemories(input.memories, { query: input.query, conversationId: input.conversationId })
  const candidates = [
    ...input.messages.slice(-20).map((message, index) => ({
      id: `message:${message.id}`, kind: 'conversation-history',
      content: `${message.role === 'assistant' ? 'Agent' : '用户'}：${message.content}`,
      priority: 2, score: 100 + index,
    })),
    ...ranked.map(({ memory, score }) => ({
      id: `memory:${memory.id}`, kind: 'memory', content: `${memory.title}\n${memory.content}${memory.tags.length ? `\n标签：${memory.tags.join('、')}` : ''}`,
      priority: memory.isPinned || memory.sourceType === 'story-bible' ? 1 : 3, score,
    })),
    ...(input.summary ? [{ id: 'conversation:summary', kind: 'conversation-summary', content: input.summary, priority: 4, score: 100 }] : []),
  ]
  const selected = selectContextSources(candidates, input.characterBudget ?? 16_000)
  return selected.sources.map((item) => ({
    id: item.id,
    kind: item.kind as AgentContextSource['kind'],
    title: item.kind === 'memory' ? '相关记忆' : item.kind === 'conversation-summary' ? '会话摘要' : '最近对话',
    content: item.content,
    nodeIds: [],
  }))
}

export function buildRollingSummary(messages: ConversationMessage[], preserveRecent = 12, characterBudget = 6_000): { summary: string; throughMessageId: string } | null {
  if (messages.length <= preserveRecent) return null
  const older = messages.slice(0, messages.length - preserveRecent)
  const summary = older
    .map((message) => `${message.role === 'assistant' ? 'Agent' : '用户'}：${message.content}`)
    .join('\n')
    .slice(0, Math.max(0, characterBudget))
  const throughMessageId = older.at(-1)?.id
  return throughMessageId ? { summary, throughMessageId } : null
}
