import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { applyPersistedStoryPatch, StoryPatchConflictError, undoPersistedStoryPatch } from './patchService.js'

const databasePath = path.resolve('prisma', `patch-service-test-${process.pid}-${randomUUID()}.db`)
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`
const prismaCli = path.resolve('node_modules/prisma/build/index.js')
const schemaPath = path.resolve('prisma/schema.prisma')
const migrations = [
  '20260629065808_init',
  '20260629104058_add_source_handle',
  '20260711000000_add_creative_agent',
]
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

function migrateTestDatabase() {
  rmSync(databasePath, { force: true })
  for (const migration of migrations) {
    execFileSync(process.execPath, [
      prismaCli, 'db', 'execute', '--schema', schemaPath, '--file',
      path.resolve(`prisma/migrations/${migration}/migration.sql`),
    ], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' })
  }
}

async function seedPatch(baseVersion = 1) {
  await client.chapterSnapshot.deleteMany()
  await client.storyPatch.deleteMany()
  await client.agentRun.deleteMany()
  await client.agentMessage.deleteMany()
  await client.agentConversation.deleteMany()
  await client.flowEdge.deleteMany()
  await client.flowNode.deleteMany()
  await client.chapter.deleteMany()
  await client.project.deleteMany()
  await client.user.deleteMany()

  await client.user.create({ data: { id: 'owner', email: 'owner@example.com', username: 'owner', password: 'hash' } })
  await client.project.create({ data: { id: 'project', title: '故事', authorId: 'owner' } })
  await client.chapter.create({
    data: {
      id: 'chapter', projectId: 'project', title: '第一章', version: 1,
      nodes: { create: { nodeId: 'start', type: 'subtitle', positionX: 0, positionY: 0, data: JSON.stringify({ text: '原始文本' }) } },
    },
  })
  await client.agentConversation.create({ data: { id: 'conversation', title: '测试', scope: 'chapter', userId: 'owner', projectId: 'project' } })
  await client.agentRun.create({
    data: { id: 'run', status: 'awaiting_approval', prompt: '修改', scope: 'chapter', provider: 'test', model: 'fake', userId: 'owner', projectId: 'project', chapterId: 'chapter', conversationId: 'conversation' },
  })
  await client.storyPatch.create({
    data: {
      id: 'patch', runId: 'run', projectId: 'project', chapterId: 'chapter', baseVersion,
      payload: JSON.stringify({ operations: [{ kind: 'updateNode', nodeId: 'start', changes: { text: '修改后文本' } }] }),
    },
  })
}

describe('transactional story patches', () => {
  beforeAll(async () => { migrateTestDatabase(); await client.$connect() })
  beforeEach(async () => { await seedPatch() })
  afterAll(async () => { await client.$disconnect(); rmSync(databasePath, { force: true }) })

  it('applies a patch with a snapshot and can restore it through undo', async () => {
    const applied = await applyPersistedStoryPatch({ patchId: 'patch', userId: 'owner' }, client)
    expect(applied.version).toBe(2)
    expect(applied.graph.nodes[0]?.data.text).toBe('修改后文本')
    expect(await client.chapterSnapshot.count()).toBe(1)

    const undone = await undoPersistedStoryPatch({ patchId: 'patch', userId: 'owner' }, client)
    expect(undone.version).toBe(3)
    expect(undone.graph.nodes[0]?.data.text).toBe('原始文本')
    expect((await client.storyPatch.findUniqueOrThrow({ where: { id: 'patch' } })).status).toBe('undone')
  })

  it('does not write when the patch base version is stale', async () => {
    await client.storyPatch.update({ where: { id: 'patch' }, data: { baseVersion: 0 } })
    await expect(applyPersistedStoryPatch({ patchId: 'patch', userId: 'owner' }, client)).rejects.toBeInstanceOf(StoryPatchConflictError)
    expect((await client.chapter.findUniqueOrThrow({ where: { id: 'chapter' } })).version).toBe(1)
    expect(await client.chapterSnapshot.count()).toBe(0)
  })

  it('refuses undo after another edit changed the chapter version', async () => {
    await applyPersistedStoryPatch({ patchId: 'patch', userId: 'owner' }, client)
    await client.chapter.update({ where: { id: 'chapter' }, data: { version: { increment: 1 } } })
    await expect(undoPersistedStoryPatch({ patchId: 'patch', userId: 'owner' }, client)).rejects.toBeInstanceOf(StoryPatchConflictError)
  })
})
