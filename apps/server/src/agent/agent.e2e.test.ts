import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { validateStoryGraph } from '@dreamchord/story-domain'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { loadAgentProjectSnapshot } from './context.js'
import { PrismaAgentRunService } from './runService.js'

const databasePath = path.resolve('prisma', `agent-e2e-test-${process.pid}-${randomUUID()}.db`)
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`
const prismaCli = path.resolve('node_modules/prisma/build/index.js')
const schemaPath = path.resolve('prisma/schema.prisma')
const migrations = ['20260629065808_init', '20260629104058_add_source_handle', '20260711000000_add_creative_agent', '20260712010000_expand_agent_conversations', '20260712020000_add_agent_memory', '20260712030000_add_asset_variants', '20260712040000_global_asset_library']
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

async function waitForCompletion(service: PrismaAgentRunService, runId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = await service.getRun(runId, 'owner')
    if (['completed', 'failed'].includes(run.status)) return run
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

  it('keeps a chapter continuation as a managed prose draft when the model only returns prose', async () => {
    const conversation = await client.agentConversation.create({ data: { title: '追查真相', scope: 'chapter', userId: 'owner', projectId: 'project', chapterId: 'chapter-one', summary: '雪正在追查旧车站。' } })
    await client.agentMessage.createMany({ data: [
      { conversationId: conversation.id, role: 'user', content: '上一轮问题：门后有什么？' },
      { conversationId: conversation.id, role: 'assistant', content: '上一轮回答：门后传来列车声。' },
    ] })
    await client.agentMemory.create({ data: { kind: 'plot', status: 'active', title: '车站真相', content: '旧车站连接着遗忘者的梦境', importance: 95, isPinned: true, sourceType: 'user', userId: 'owner', projectId: 'project' } })
    let received = ''
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider: () => ({ chat: async (messages) => { received = JSON.stringify(messages); return JSON.stringify({ type: 'final', summary: '已续写', plan: ['承接线索'] }) } }),
    })
    const queued = await service.createRun({ projectId: 'project', conversationId: conversation.id, chapterId: 'chapter-one', prompt: '继续写雪的调查', scope: 'chapter', providerConfig: { provider: 'fake', model: 'controlled', apiKey: 'memory-only' } }, 'owner')
    const ready = await waitForCompletion(service, queued.id)
    expect(ready.status).toBe('completed')
    expect(ready.patch).toBeNull()
    expect(received).toContain('上一轮回答')
    expect(received).toContain('遗忘者的梦境')
    expect(received).toContain('雪正在追查旧车站')
  })

  it('keeps the selected draft text when its own wording mentions confirmation', async () => {
    const conversation = await client.agentConversation.create({ data: { title: '指定草稿', scope: 'chapter', userId: 'owner', projectId: 'project', chapterId: 'chapter-one' } })
    const selectedDraft = '林宇：\n“等雨停了，我们就出发。”\n\n林晚没有回答，只把车票攥得更紧。确认后写入工作台。'
    const chat = vi.fn(async () => JSON.stringify({ type: 'final', summary: '不应参与草稿转换', plan: [], patch: { operations: [] } }))
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider: () => ({ chat }),
    })
    const queued = await service.createRun({
      projectId: 'project', conversationId: conversation.id, chapterId: 'chapter-one', scope: 'chapter',
      prompt: `根据用户选择的续写草稿创建工作台场景。\n\n【已选草稿】\n${selectedDraft}\n【草稿结束】`,
      providerConfig: { provider: 'fake', model: 'controlled', apiKey: 'memory-only' },
    }, 'owner')
    const ready = await waitForApproval(service, queued.id)

    expect(ready.status).toBe('awaiting_approval')
    expect(ready.patch?.payload).toEqual(expect.objectContaining({ operations: expect.arrayContaining([
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '林宇', text: expect.stringContaining('等雨停了') }) }) }),
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'subtitle', data: expect.objectContaining({ text: expect.stringContaining('车票') }) }) }),
    ]) }))
    expect(chat).not.toHaveBeenCalled()
  })

  it('completes a project conversation without selecting a chapter', async () => {
    let received = ''
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider: () => ({ chat: async (messages) => {
        received = JSON.stringify(messages)
        return JSON.stringify({ type: 'final', summary: '项目结构清晰，共两章。', plan: ['读取项目概览'] })
      } }),
    })
    const conversation = await service.createConversation('project', 'owner', { title: '项目规划', scope: 'project' })
    const queued = await service.createRun({
      projectId: 'project', conversationId: conversation.id, prompt: '概括整个项目', scope: 'project',
      providerConfig: { provider: 'fake', model: 'controlled', apiKey: 'memory-only' },
    }, 'owner')
    const completed = await waitForCompletion(service, queued.id)

    expect(completed.status).toBe('completed')
    expect(completed.errorMessage).toBeNull()
    expect(received).toContain('project:outline')
    expect(await client.agentMessage.findFirst({ where: { conversationId: conversation.id, role: 'assistant' } })).toMatchObject({
      content: '项目结构清晰，共两章。',
    })
  })

  it('keeps a project conversation read-only when the model returns a story patch without a chapter', async () => {
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider: () => ({ chat: async () => JSON.stringify({
        type: 'final', summary: '尝试修改剧情', plan: [],
        patch: { operations: [{ kind: 'addNode', tempId: 'new', node: { type: 'subtitle', data: { text: '新剧情' } } }] },
      }) }),
    })
    const conversation = await service.createConversation('project', 'owner', { title: '项目规划限制', scope: 'project' })
    const queued = await service.createRun({
      projectId: 'project', conversationId: conversation.id, prompt: '直接修改剧情', scope: 'project',
      providerConfig: { provider: 'fake', model: 'controlled', apiKey: 'memory-only' },
    }, 'owner')
    const completed = await waitForCompletion(service, queued.id)

    expect(completed.status).toBe('completed')
    expect(completed.errorMessage).toBeNull()
    expect(completed.patch).toBeNull()
    expect(await client.agentMessage.findFirst({ where: { conversationId: conversation.id, role: 'assistant' } })).toMatchObject({
      content: '尝试修改剧情',
    })
  })

  it('does not overwrite a cancellation that happens while persisting a reply', async () => {
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider: () => ({ chat: async () => JSON.stringify({ type: 'final', summary: 'cancel race', plan: [] }) }),
    })
    const conversation = await service.createConversation('project', 'owner', { title: 'cancel race', scope: 'project' })
    let runId = ''
    const serviceWithPrivate = service as unknown as {
      refreshConversationSummary: (id: string) => Promise<void>
    }
    const originalRefresh = serviceWithPrivate.refreshConversationSummary
    serviceWithPrivate.refreshConversationSummary = async (id) => {
      while (!runId) await new Promise((resolve) => setTimeout(resolve, 1))
      await service.cancelRun(runId, 'owner')
      await originalRefresh.call(service, id)
    }
    const queued = await service.createRun({
      projectId: 'project', conversationId: conversation.id, prompt: '概括整个项目', scope: 'project',
      providerConfig: { provider: 'fake', model: 'controlled', apiKey: 'memory-only' },
    }, 'owner')
    runId = queued.id

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const run = await service.getRun(queued.id, 'owner')
      if (['completed', 'cancelled', 'failed'].includes(run.status)) {
        expect(run.status).toBe('cancelled')
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    throw new Error('Agent run did not settle')
  })

  it('runs the local assistant without an API key or external provider call', async () => {
    const createProvider = vi.fn(() => { throw new Error('external provider must not be called') })
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider,
    })
    const conversation = await service.createConversation('project', 'owner', { title: '本地项目体检', scope: 'project' })
    const queued = await service.createRun({
      projectId: 'project', conversationId: conversation.id, prompt: '概括整个项目', scope: 'project',
      providerConfig: { provider: 'local', model: 'dreamchord-local', apiKey: '' },
    }, 'owner')
    const completed = await waitForCompletion(service, queued.id)

    expect(completed.status).toBe('completed')
    expect(completed.errorMessage).toBeNull()
    expect(createProvider).not.toHaveBeenCalled()
    expect(await client.agentMessage.findFirst({ where: { conversationId: conversation.id, role: 'assistant' } })).toMatchObject({
      content: expect.stringContaining('2 个章节'),
    })
  })

  it('answers an immediate greeting locally even when an external provider is configured', async () => {
    const createProvider = vi.fn(() => { throw new Error('greetings must not call the external provider') })
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider,
    })
    const conversation = await service.createConversation('project', 'owner', { title: '自然问候', scope: 'project' })
    const queued = await service.createRun({
      projectId: 'project', conversationId: conversation.id, prompt: '你好', scope: 'project',
      providerConfig: { provider: 'glm', model: 'glm-4.7-flash', apiKey: 'memory-only' },
    }, 'owner')
    const completed = await waitForCompletion(service, queued.id)

    expect(completed.status).toBe('completed')
    expect(createProvider).not.toHaveBeenCalled()
    expect(await client.agentMessage.findFirst({ where: { conversationId: conversation.id, role: 'assistant' } })).toMatchObject({
      content: expect.stringContaining('DreamChord 创作 Agent'),
    })
  })

  it('answers a time question locally even when an external provider is configured', async () => {
    const createProvider = vi.fn(() => { throw new Error('time questions must not call the external provider') })
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider,
    })
    const conversation = await service.createConversation('project', 'owner', { title: '时间问题', scope: 'project' })
    const queued = await service.createRun({
      projectId: 'project', conversationId: conversation.id, prompt: '现在几点', scope: 'project',
      providerConfig: { provider: 'glm', model: 'glm-4.7-flash', apiKey: 'memory-only' },
    }, 'owner')
    const completed = await waitForCompletion(service, queued.id)

    expect(completed.status).toBe('completed')
    expect(createProvider).not.toHaveBeenCalled()
    expect(await client.agentMessage.findFirst({ where: { conversationId: conversation.id, role: 'assistant' } })).toMatchObject({
      content: expect.stringContaining('北京时间'),
    })
  })

  it('accepts a general natural-language answer in one provider call', async () => {
    const chat = vi.fn(async () => '主题是人在遗忘中仍然选择彼此。')
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider: () => ({ chat }),
    })
    const conversation = await service.createConversation('project', 'owner', { title: '主题讨论', scope: 'project' })
    const queued = await service.createRun({
      projectId: 'project', conversationId: conversation.id, prompt: '你觉得这个故事的主题是什么？', scope: 'project',
      providerConfig: { provider: 'fake', model: 'controlled', apiKey: 'memory-only' },
    }, 'owner')
    const completed = await waitForCompletion(service, queued.id)

    expect(completed.status).toBe('completed')
    expect(chat).toHaveBeenCalledOnce()
    expect(await client.agentMessage.findFirst({ where: { conversationId: conversation.id, role: 'assistant' } })).toMatchObject({
      content: '主题是人在遗忘中仍然选择彼此。',
    })
  })

  it('persists a visible assistant message when the provider fails', async () => {
    const service = new PrismaAgentRunService(client, {
      loadSnapshot: (projectId) => loadAgentProjectSnapshot(projectId, client),
      createProvider: () => ({ chat: async () => { throw new Error('模型暂时不可用') } }),
    })
    const conversation = await service.createConversation('project', 'owner', { title: '故障可见性', scope: 'project' })
    const queued = await service.createRun({
      projectId: 'project', conversationId: conversation.id, prompt: '解释一下蒙太奇', scope: 'project',
      providerConfig: { provider: 'fake', model: 'controlled', apiKey: 'memory-only' },
    }, 'owner')
    const failed = await waitForCompletion(service, queued.id)

    expect(failed.status).toBe('failed')
    expect(await client.agentMessage.findFirst({ where: { conversationId: conversation.id, role: 'assistant' } })).toMatchObject({
      content: expect.stringContaining('模型暂时不可用'),
    })
  })

  it('returns a version-conflicted apply run to awaiting approval', async () => {
    const conversation = await client.agentConversation.create({ data: { title: '冲突测试', scope: 'chapter', userId: 'owner', projectId: 'project', chapterId: 'chapter-one' } })
    const run = await client.agentRun.create({ data: {
      status: 'awaiting_approval', prompt: '应用冲突补丁', scope: 'chapter', provider: 'fake', model: 'controlled',
      userId: 'owner', projectId: 'project', chapterId: 'chapter-one', conversationId: conversation.id,
    } })
    const chapter = await client.chapter.findUniqueOrThrow({ where: { id: 'chapter-one' }, select: { version: true } })
    await client.storyPatch.create({ data: {
      runId: run.id, projectId: 'project', chapterId: 'chapter-one', baseVersion: chapter.version - 1,
      payload: JSON.stringify({ operations: [] }), validation: '{}', diff: '{}',
    } })
    const service = new PrismaAgentRunService(client)

    await expect(service.applyRun(run.id, 'owner')).rejects.toThrow()
    expect((await service.getRun(run.id, 'owner')).status).toBe('awaiting_approval')
  })

  it('returns the applied graph and version when artifact memory persistence fails', async () => {
    const conversation = await client.agentConversation.create({ data: { title: '记忆失败测试', scope: 'chapter', userId: 'owner', projectId: 'project', chapterId: 'chapter-one' } })
    const run = await client.agentRun.create({ data: {
      status: 'awaiting_approval', prompt: '应用补丁', scope: 'chapter', provider: 'fake', model: 'controlled',
      userId: 'owner', projectId: 'project', chapterId: 'chapter-one', conversationId: conversation.id,
    } })
    const chapter = await client.chapter.findUniqueOrThrow({ where: { id: 'chapter-one' }, select: { version: true } })
    await client.storyPatch.create({ data: {
      runId: run.id, projectId: 'project', chapterId: 'chapter-one', baseVersion: chapter.version,
      payload: JSON.stringify({ operations: [{ kind: 'addNode', tempId: 'artifact-node', node: { type: 'subtitle', data: { text: '记忆失败也应完成' } }, anchor: { afterNodeId: 'c1-start' } }] }),
      validation: '{}', diff: '{}',
    } })
    const memoryCreate = vi.spyOn(client.agentMemory, 'create').mockRejectedValueOnce(new Error('memory unavailable'))
    const service = new PrismaAgentRunService(client)

    const applied = await service.applyRun(run.id, 'owner')

    expect(applied.version).toBe(chapter.version + 1)
    expect(applied.graph.nodes.some((node) => node.data.text === '记忆失败也应完成')).toBe(true)
    expect((await service.getRun(run.id, 'owner')).status).toBe('completed')
    memoryCreate.mockRestore()
  })
})
