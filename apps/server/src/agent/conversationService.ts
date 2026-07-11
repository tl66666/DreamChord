import type { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import type { AgentScope } from './context.js'

export interface ConversationDto {
  id: string
  title: string
  scope: string
  chapterId: string | null
  isPinned: boolean
  summary: string
  createdAt: string
  updatedAt: string
}

export interface AgentMessageDto {
  id: string
  role: string
  content: string
  metadata: unknown
  createdAt: string
}

export interface MessagePageDto {
  items: AgentMessageDto[]
  nextCursor: string | null
}

export interface ConversationService {
  list(projectId: string, userId: string, query?: string): Promise<ConversationDto[]>
  create(projectId: string, userId: string, input: { title: string; scope: AgentScope; chapterId?: string }): Promise<ConversationDto>
  get(id: string, userId: string): Promise<ConversationDto>
  update(id: string, userId: string, patch: { title?: string; scope?: AgentScope; chapterId?: string | null; isPinned?: boolean }): Promise<ConversationDto>
  remove(id: string, userId: string): Promise<void>
  messages(id: string, userId: string, cursor?: string, limit?: number): Promise<MessagePageDto>
}

function iso(value: Date): string { return value.toISOString() }
function parseMetadata(value: string): unknown { try { return JSON.parse(value) } catch { return {} } }
function normalizeTitle(value: string): string {
  const title = value.trim()
  if (!title) throw new Error('标题不能为空')
  return title
}

export class PrismaConversationService implements ConversationService {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(projectId: string, userId: string, query = ''): Promise<ConversationDto[]> {
    const rows = await this.client.agentConversation.findMany({
      where: {
        projectId,
        userId,
        deletedAt: null,
        ...(query.trim() ? { title: { contains: query.trim() } } : {}),
      },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    })
    return rows.map(toConversationDto)
  }

  async create(projectId: string, userId: string, input: { title: string; scope: AgentScope; chapterId?: string }): Promise<ConversationDto> {
    await this.requireProjectOwner(projectId, userId)
    if (input.chapterId) await this.requireChapter(projectId, input.chapterId)
    return toConversationDto(await this.client.agentConversation.create({ data: {
      projectId,
      userId,
      title: normalizeTitle(input.title),
      scope: input.scope,
      chapterId: input.chapterId,
    } }))
  }

  async get(id: string, userId: string): Promise<ConversationDto> {
    return toConversationDto(await this.requireConversation(id, userId))
  }

  async update(id: string, userId: string, patch: { title?: string; scope?: AgentScope; chapterId?: string | null; isPinned?: boolean }): Promise<ConversationDto> {
    const current = await this.requireConversation(id, userId)
    if (patch.chapterId) await this.requireChapter(current.projectId, patch.chapterId)
    const title = patch.title === undefined ? undefined : normalizeTitle(patch.title)
    return toConversationDto(await this.client.agentConversation.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(patch.scope !== undefined ? { scope: patch.scope } : {}),
        ...(patch.chapterId !== undefined ? { chapterId: patch.chapterId } : {}),
        ...(patch.isPinned !== undefined ? { isPinned: patch.isPinned } : {}),
      },
    }))
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.requireConversation(id, userId)
    await this.client.$transaction([
      this.client.agentMessage.deleteMany({ where: { conversationId: id } }),
      this.client.agentConversation.update({ where: { id }, data: {
        deletedAt: new Date(),
        isPinned: false,
        title: '已删除会话',
        summary: '',
        summaryThroughMessageId: null,
      } }),
    ])
  }

  async messages(id: string, userId: string, cursor?: string, limit = 30): Promise<MessagePageDto> {
    await this.requireConversation(id, userId)
    const take = Math.min(Math.max(limit, 1), 100)
    const rows = await this.client.agentMessage.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > take
    const page = rows.slice(0, take)
    return {
      items: page.reverse().map((row) => ({ id: row.id, role: row.role, content: row.content, metadata: parseMetadata(row.metadata), createdAt: iso(row.createdAt) })),
      nextCursor: hasMore ? page[0]?.id ?? null : null,
    }
  }

  private async requireProjectOwner(projectId: string, userId: string): Promise<void> {
    const project = await this.client.project.findUnique({ where: { id: projectId }, select: { authorId: true } })
    if (!project) throw new Error('项目不存在')
    if (project.authorId !== userId) throw new Error('无权访问此项目')
  }

  private async requireChapter(projectId: string, chapterId: string): Promise<void> {
    const chapter = await this.client.chapter.findFirst({ where: { id: chapterId, projectId }, select: { id: true } })
    if (!chapter) throw new Error('章节不存在')
  }

  private async requireConversation(id: string, userId: string) {
    const conversation = await this.client.agentConversation.findFirst({ where: { id, userId, deletedAt: null } })
    if (!conversation) throw new Error('会话不存在')
    return conversation
  }
}

function toConversationDto(row: {
  id: string; title: string; scope: string; chapterId: string | null; isPinned: boolean; summary: string; createdAt: Date; updatedAt: Date
}): ConversationDto {
  return {
    id: row.id,
    title: row.title,
    scope: row.scope,
    chapterId: row.chapterId,
    isPinned: row.isPinned,
    summary: row.summary,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export const prismaConversationService = new PrismaConversationService()
