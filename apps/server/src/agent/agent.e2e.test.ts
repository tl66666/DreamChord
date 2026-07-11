import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { validateStoryGraph } from '@dreamchord/story-domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadAgentProjectSnapshot } from './context.js'
import { PrismaAgentRunService } from './runService.js'

const databasePath = path.resolve('prisma', `agent-e2e-test-${process.pid}-${randomUUID()}.db`)
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`
const prismaCli = path.resolve('node_modules/prisma/build/index.js')
const schemaPath = path.resolve('prisma/schema.prisma')
const migrations = ['20260629065808_init', '20260629104058_add_source_handle', '20260711000000_add_creative_agent', '20260712010000_expand_agent_conversations']
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

function migrateDatabase() {
  rmSync(databasePath, { force: true })
  for (const migration of migrations) {
    execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--schema', schemaPath, '--file', path.resolve(`prisma/migrations/${migration}/migration.sql`)], {
      env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe',
    })
  }
}

async function waitForApproval(service: PrismaAgentRunService, runId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = await service.getRun(runId, 'owner')
    if (run.status === 'awaiting_approval' || run.status === 'failed') return run
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Agent run did not settle')
}

describe('creative agent end-to-end workflow', () => {
  beforeAll(async () => {
    migrateDatabase()
    await client.$connect()
    await client.user.create({ data: { id: 'owner', email: 'agent-owner@example.com', username: 'agent-owner', password: 'hash' } })
    await client.project.create({ data: { id: 'project', title: '双章节故事', authorId: 'owner' } })
    await client.chapter.create({ data: { id: 'chapter-one', projectId: 'project', title: '第一章', order: 0, nodes: { create: { nodeId: 'c1-start', type: 'subtitle', positionX: 0, positionY: 0, data: JSON.stringify({ text: '第一章原文' }) } } } })
    await client.chapter.create({ data: { id: 'chapter-two', projectId: 'project', title: '第二章', order: 1, nodes: { create: { nodeId: 'c2-start', type: 'subtitle', positionX: 0, positionY: 0, data: JSON.stringify({ text: '第二章原文' }) } } } })
  })
  afterAll(async () => { await client.$disconnect(); rmSync(databasePath, { force: true }) })

  it('plans, tools, applies only the selected chapter, and restores it through undo', async () => {
    const patch = {
      operations: [
        { kind: 'addNode', tempId: 'choice', node: { type: 'choice', data: { choices: ['追问', '离开'] } }, anchor: { afterNodeId: 'c2-start' } },
        { kind: 'addNode', tempId: 'ask', node: { type: 'dialogue', data: { role: '雪', text: '你究竟是谁？' } } },
        { kind: 'addNode', tempId: 'leave', node: { type: 'subtitle', data: { text: '雪转身离开。' } } },
        { kind: 'addEdge', sourceRef: 'c2-start', targetRef: 'choice' },
        { kind: 'addEdge', sourceRef: 'choice', targetRef: 'ask', sourceHandle: 'choice-0', label: '追问' },
        { kind: 'addEdge', sourceRef: 'choice', targetRef: 'leave', sourceHandle: 'choice-1', label: '离开' },
      ],
    }
    const responses = [
      JSON.stringify({ type: 'tool_call', tool: 'read_chapter_outline', input: { chapterId: 'chapter-two' } }),
      JSON.stringify({ type: 'tool_call', tool: 'analyze_story_graph', input: {} }),
      JSON.stringify({ type: 'final', summary: '补充第二章分支', plan: ['读取第二章', '检查结构', '补充分支'], patch }),
    ]
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider: () => ({ chat: async () => responses.shift() ?? '' }),
    })
    const conversation = await service.createConversation('project', 'owner', { title: '第二章分支', scope: 'chapter' })
    const queued = await service.createRun({ projectId: 'project', conversationId: conversation.id, chapterId: 'chapter-two', prompt: '给第二章增加两条不同走向', scope: 'chapter', providerConfig: { provider: 'fake', model: 'controlled', apiKey: 'memory-only' } }, 'owner')
    const ready = await waitForApproval(service, queued.id)

    expect(ready.errorMessage).toBeNull()
    expect(ready.status).toBe('awaiting_approval')
    expect(ready.timeline).toEqual(expect.arrayContaining([expect.objectContaining({ tool: 'read_chapter_outline' }), expect.objectContaining({ tool: 'analyze_story_graph' })]))
    const applied = await service.applyRun(ready.id, 'owner')
    expect(applied.chapterId).toBe('chapter-two')
    expect(applied.version).toBe(2)
    expect(validateStoryGraph(applied.graph).valid).toBe(true)
    expect(await client.flowNode.count({ where: { chapterId: 'chapter-one' } })).toBe(1)
    expect(await client.flowNode.count({ where: { chapterId: 'chapter-two' } })).toBe(4)

    const undone = await service.undoRun(ready.id, 'owner')
    expect(undone.version).toBe(3)
    expect(undone.graph.nodes.map((node) => node.id)).toEqual(['c2-start'])
    expect(undone.graph.edges).toEqual([])
  })
})
