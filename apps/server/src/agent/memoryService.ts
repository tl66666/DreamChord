import type { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export type MemoryKind = 'canon' | 'character' | 'preference' | 'plot' | 'decision' | 'artifact'
export type MemoryStatus = 'suggested' | 'active' | 'forgotten'

export interface RankableMemory {
  id: string
  kind: MemoryKind
  title: string
  content: string
  tags: string[]
  importance: number
  status: MemoryStatus
  isPinned: boolean
  sourceType: string
  conversationId: string | null
  supersededById: string | null
  updatedAt: Date
}

export interface RankedMemory {
  memory: RankableMemory
  score: number
  reasons: string[]
}

export interface MemoryRankOptions {
  query: string
  conversationId?: string | null
  now?: Date
}

const AUTHORITATIVE_SOURCES = new Set(['story-bible', 'user', 'editor'])

function terms(value: string): string[] {
  const normalized = value.toLocaleLowerCase().trim()
  if (!normalized) return []
  const words = normalized.match(/[\p{Script=Han}]|[\p{L}\p{N}_-]{2,}/gu) ?? []
  return [...new Set(words)]
}

export function rankMemories(memories: RankableMemory[], options: MemoryRankOptions): RankedMemory[] {
  const now = options.now ?? new Date()
  const queryTerms = terms(options.query)

  return memories
    .filter((memory) => memory.status === 'active')
    .filter((memory) => memory.supersededById === null)
    .filter((memory) => memory.conversationId === null || memory.conversationId === options.conversationId)
    .map((memory) => {
      const reasons: string[] = []
      let score = Math.max(0, Math.min(100, memory.importance)) * 0.45

      if (memory.isPinned) {
        score += 60
        reasons.push('固定记忆')
      }
      if (AUTHORITATIVE_SOURCES.has(memory.sourceType)) {
        score += 35
        reasons.push('权威来源')
      }
      if (memory.conversationId && memory.conversationId === options.conversationId) {
        score += 12
        reasons.push('当前会话')
      }

      const searchable = terms(`${memory.title} ${memory.content} ${memory.tags.join(' ')}`)
      const matches = queryTerms.filter((term) => searchable.some((candidate) => candidate.includes(term) || term.includes(candidate)))
      if (matches.length > 0) {
        score += Math.min(50, matches.length * 8)
        reasons.push(`相关词：${matches.slice(0, 3).join('、')}`)
      }

      const ageDays = Math.max(0, (now.getTime() - memory.updatedAt.getTime()) / 86_400_000)
      const recency = Math.max(0, 15 - Math.log2(ageDays + 1) * 3)
      score += recency
      if (ageDays <= 7) reasons.push('近期更新')

      return { memory, score: Math.round(score * 100) / 100, reasons }
    })
    .sort((left, right) => right.score - left.score || right.memory.updatedAt.getTime() - left.memory.updatedAt.getTime())
}

export interface AgentMemoryDto extends Omit<RankableMemory, 'updatedAt'> {
  projectId: string
  sourceId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMemoryInput {
  kind: MemoryKind
  title: string
  content: string
  tags?: string[]
  importance?: number
  status?: MemoryStatus
  isPinned?: boolean
  sourceType?: string
  sourceId?: string
  conversationId?: string
}

export interface MemoryService {
  list(projectId: string, userId: string, options?: { conversationId?: string; includeForgotten?: boolean }): Promise<AgentMemoryDto[]>
  create(projectId: string, userId: string, input: CreateMemoryInput): Promise<AgentMemoryDto>
  update(id: string, userId: string, patch: Partial<Omit<CreateMemoryInput, 'conversationId'>>): Promise<AgentMemoryDto>
  forget(id: string, userId: string): Promise<void>
  retrieve(projectId: string, userId: string, options: { query: string; conversationId?: string; limit?: number }): Promise<RankedMemory[]>
}

function text(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${label}不能为空`)
  return normalized
}

function parseTags(value: string): string[] {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [] } catch { return [] }
}

export class PrismaMemoryService implements MemoryService {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(projectId: string, userId: string, options: { conversationId?: string; includeForgotten?: boolean } = {}): Promise<AgentMemoryDto[]> {
    await this.requireProjectOwner(projectId, userId)
    const rows = await this.client.agentMemory.findMany({
      where: {
        projectId, userId,
        ...(options.includeForgotten ? {} : { status: { not: 'forgotten' } }),
        ...(options.conversationId ? { OR: [{ conversationId: null }, { conversationId: options.conversationId }] } : { conversationId: null }),
      },
      orderBy: [{ isPinned: 'desc' }, { importance: 'desc' }, { updatedAt: 'desc' }],
    })
    return rows.map(toDto)
  }

  async create(projectId: string, userId: string, input: CreateMemoryInput): Promise<AgentMemoryDto> {
    await this.requireProjectOwner(projectId, userId)
    if (input.conversationId) await this.requireConversation(projectId, userId, input.conversationId)
    const row = await this.client.agentMemory.create({ data: {
      projectId, userId, kind: input.kind, title: text(input.title, '标题'), content: text(input.content, '内容'),
      tags: JSON.stringify(input.tags ?? []), importance: Math.max(0, Math.min(100, input.importance ?? 50)),
      status: input.status ?? 'suggested', isPinned: input.isPinned ?? false, sourceType: input.sourceType ?? 'assistant',
      sourceId: input.sourceId, conversationId: input.conversationId,
    } })
    return toDto(row)
  }

  async update(id: string, userId: string, patch: Partial<Omit<CreateMemoryInput, 'conversationId'>>): Promise<AgentMemoryDto> {
    await this.requireMemory(id, userId)
    const row = await this.client.agentMemory.update({ where: { id }, data: {
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.title !== undefined ? { title: text(patch.title, '标题') } : {}),
      ...(patch.content !== undefined ? { content: text(patch.content, '内容') } : {}),
      ...(patch.tags !== undefined ? { tags: JSON.stringify(patch.tags) } : {}),
      ...(patch.importance !== undefined ? { importance: Math.max(0, Math.min(100, patch.importance)) } : {}),
      ...(patch.status !== undefined ? { status: patch.status, forgottenAt: patch.status === 'forgotten' ? new Date() : null } : {}),
      ...(patch.isPinned !== undefined ? { isPinned: patch.isPinned } : {}),
      ...(patch.sourceType !== undefined ? { sourceType: patch.sourceType } : {}),
      ...(patch.sourceId !== undefined ? { sourceId: patch.sourceId } : {}),
    } })
    return toDto(row)
  }

  async forget(id: string, userId: string): Promise<void> {
    await this.requireMemory(id, userId)
    await this.client.agentMemory.update({ where: { id }, data: { status: 'forgotten', forgottenAt: new Date(), isPinned: false } })
  }

  async retrieve(projectId: string, userId: string, options: { query: string; conversationId?: string; limit?: number }): Promise<RankedMemory[]> {
    const rows = await this.list(projectId, userId, { conversationId: options.conversationId })
    return rankMemories(rows.map((row) => ({ ...row, updatedAt: new Date(row.updatedAt) })), options).slice(0, Math.min(50, Math.max(1, options.limit ?? 12)))
  }

  private async requireProjectOwner(projectId: string, userId: string): Promise<void> {
    const project = await this.client.project.findUnique({ where: { id: projectId }, select: { authorId: true } })
    if (!project) throw new Error('项目不存在')
    if (project.authorId !== userId) throw new Error('无权访问此项目')
  }

  private async requireConversation(projectId: string, userId: string, conversationId: string): Promise<void> {
    const conversation = await this.client.agentConversation.findFirst({ where: { id: conversationId, projectId, userId, deletedAt: null }, select: { id: true } })
    if (!conversation) throw new Error('会话不存在')
  }

  private async requireMemory(id: string, userId: string): Promise<void> {
    if (!await this.client.agentMemory.findFirst({ where: { id, userId }, select: { id: true } })) throw new Error('记忆不存在')
  }
}

function toDto(row: { id: string; projectId: string; conversationId: string | null; kind: string; title: string; content: string; tags: string; importance: number; status: string; isPinned: boolean; sourceType: string; sourceId: string | null; supersededById: string | null; createdAt: Date; updatedAt: Date }): AgentMemoryDto {
  return {
    id: row.id, projectId: row.projectId, conversationId: row.conversationId, kind: row.kind as MemoryKind,
    title: row.title, content: row.content, tags: parseTags(row.tags), importance: row.importance,
    status: row.status as MemoryStatus, isPinned: row.isPinned, sourceType: row.sourceType, sourceId: row.sourceId,
    supersededById: row.supersededById, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  }
}

export const prismaMemoryService = new PrismaMemoryService()
