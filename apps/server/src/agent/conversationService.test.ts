import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaConversationService } from './conversationService.js'

const databasePath = path.resolve('prisma', `conversation-service-test-${process.pid}-${randomUUID()}.db`)
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`
const prismaCli = path.resolve('node_modules/prisma/build/index.js')
const schemaPath = path.resolve('prisma/schema.prisma')
const migrations = [
  '20260629065808_init',
  '20260629104058_add_source_handle',
  '20260711000000_add_creative_agent',
  '20260712010000_expand_agent_conversations',
]
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const service = new PrismaConversationService(client)

describe('conversation service', () => {
  beforeAll(async () => {
    rmSync(databasePath, { force: true })
    for (const migration of migrations) {
      execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--schema', schemaPath, '--file', path.resolve(`prisma/migrations/${migration}/migration.sql`)], {
        env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe',
      })
    }
    await client.$connect()
    await client.user.createMany({ data: [
      { id: 'owner', email: 'owner-conversation@example.com', username: 'owner-conversation', password: 'hash' },
      { id: 'other', email: 'other-conversation@example.com', username: 'other-conversation', password: 'hash' },
    ] })
    await client.project.create({ data: { id: 'project', title: '故事', authorId: 'owner' } })
    await client.chapter.create({ data: { id: 'chapter', title: '第一章', projectId: 'project' } })
  })

  afterAll(async () => { await client.$disconnect(); rmSync(databasePath, { force: true }) })

  it('creates, searches, pins, and validates conversations', async () => {
    const first = await service.create('project', 'owner', { title: ' 第一章续写 ', scope: 'chapter', chapterId: 'chapter' })
    const second = await service.create('project', 'owner', { title: '人物设定', scope: 'project' })
    await service.update(first.id, 'owner', { isPinned: true })

    expect((await service.list('project', 'owner')).map((item) => item.id)).toEqual([first.id, second.id])
    expect((await service.list('project', 'owner', '人物')).map((item) => item.id)).toEqual([second.id])
    await expect(service.update(first.id, 'owner', { title: '   ' })).rejects.toThrow('标题不能为空')
    await expect(service.get(first.id, 'other')).rejects.toThrow('会话不存在')
  })

  it('paginates messages and preserves run artifacts when deleting the conversation', async () => {
    const conversation = await service.create('project', 'owner', { title: '删除测试', scope: 'chapter', chapterId: 'chapter' })
    for (const content of ['一', '二', '三']) {
      await client.agentMessage.create({ data: { conversationId: conversation.id, role: 'user', content } })
    }
    const run = await client.agentRun.create({ data: {
      id: 'conversation-run', status: 'completed', prompt: '测试', scope: 'chapter', provider: 'fake', model: 'fake',
      userId: 'owner', projectId: 'project', chapterId: 'chapter', conversationId: conversation.id,
    } })
    await client.storyPatch.create({ data: {
      id: 'conversation-patch', runId: run.id, projectId: 'project', chapterId: 'chapter', baseVersion: 1,
      payload: JSON.stringify({ operations: [] }), status: 'applied',
    } })

    const latest = await service.messages(conversation.id, 'owner', undefined, 2)
    expect(latest.items.map((item) => item.content)).toEqual(['二', '三'])
    expect(latest.nextCursor).toBeTruthy()
    const older = await service.messages(conversation.id, 'owner', latest.nextCursor!, 2)
    expect(older.items.map((item) => item.content)).toEqual(['一'])

    await service.remove(conversation.id, 'owner')
    await expect(service.get(conversation.id, 'owner')).rejects.toThrow('会话不存在')
    expect(await client.agentMessage.count({ where: { conversationId: conversation.id } })).toBe(0)
    expect(await client.agentRun.count({ where: { id: run.id } })).toBe(1)
    expect(await client.storyPatch.count({ where: { id: 'conversation-patch' } })).toBe(1)
  })

  it('persists an edited conversation draft for its owner', async () => {
    const conversation = await service.create('project', 'owner', { title: '草稿编辑', scope: 'chapter', chapterId: 'chapter' })
    const message = await client.agentMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: '林晚站在雨里。' } })

    await service.updateMessage(conversation.id, message.id, 'owner', '林晚站在雨里，攥紧了旧车票。')

    expect((await service.messages(conversation.id, 'owner')).items[0]?.content).toBe('林晚站在雨里，攥紧了旧车票。')
  })
})
