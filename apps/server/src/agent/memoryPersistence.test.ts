import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaMemoryService } from './memoryService.js'

const databasePath = path.resolve('prisma', `memory-service-test-${process.pid}-${randomUUID()}.db`)
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`
const prismaCli = path.resolve('node_modules/prisma/build/index.js')
const schemaPath = path.resolve('prisma/schema.prisma')
const migrations = ['20260629065808_init', '20260629104058_add_source_handle', '20260711000000_add_creative_agent', '20260712010000_expand_agent_conversations', '20260712020000_add_agent_memory']
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const service = new PrismaMemoryService(client)

describe('memory persistence', () => {
  beforeAll(async () => {
    rmSync(databasePath, { force: true })
    for (const migration of migrations) execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--schema', schemaPath, '--file', path.resolve(`prisma/migrations/${migration}/migration.sql`)], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' })
    await client.$connect()
    await client.user.createMany({ data: [
      { id: 'owner', email: 'memory-owner@example.com', username: 'memory-owner', password: 'hash' },
      { id: 'other', email: 'memory-other@example.com', username: 'memory-other', password: 'hash' },
    ] })
    await client.project.create({ data: { id: 'project', title: '故事', authorId: 'owner' } })
    await client.agentConversation.create({ data: { id: 'conversation', title: '续写', scope: 'project', userId: 'owner', projectId: 'project' } })
  })

  afterAll(async () => { await client.$disconnect(); rmSync(databasePath, { force: true }) })

  it('creates, retrieves, updates, and forgets visible memory', async () => {
    const created = await service.create('project', 'owner', {
      kind: 'character', title: '雪', content: '雪害怕被遗忘', tags: ['女主角'], importance: 85,
      status: 'active', isPinned: true, sourceType: 'user', conversationId: 'conversation',
    })
    expect((await service.list('project', 'owner', { conversationId: 'conversation' }))[0]).toMatchObject({ id: created.id, isPinned: true })
    expect((await service.retrieve('project', 'owner', { query: '续写雪的秘密', conversationId: 'conversation' }))[0]?.reasons).toContain('固定记忆')
    expect(await service.update(created.id, 'owner', { importance: 95 })).toMatchObject({ importance: 95 })
    await service.forget(created.id, 'owner')
    expect(await service.list('project', 'owner', { conversationId: 'conversation' })).toEqual([])
  })

  it('enforces project ownership and conversation scope', async () => {
    await expect(service.list('project', 'other')).rejects.toThrow('无权访问此项目')
    await expect(service.create('project', 'owner', { kind: 'canon', title: '错误会话', content: 'x', conversationId: 'missing' })).rejects.toThrow('会话不存在')
  })
})
