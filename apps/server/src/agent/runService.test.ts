import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PrismaAgentRunService, RunAbortRegistry } from './runService.js'
import type { AgentProjectSnapshot } from './context.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function runHarness(prompt = '你好', chapterId: string | null = null) {
  const row = { id: 'run', userId: 'owner', projectId: 'project', conversationId: 'conversation', chapterId,
    status: 'queued', prompt, scope: chapterId ? 'chapter' : 'project', provider: 'fake', model: 'controlled',
    plan: '[]', timeline: '[]', sources: '[]', validation: '{}', usage: '{}', createdAt: new Date(), updatedAt: new Date(), completedAt: null, patch: null }
  const snapshot: AgentProjectSnapshot = { projectId: 'project', title: '测试', description: '', bible: null, characters: [], assets: [],
    chapters: chapterId ? [{ id: chapterId, title: '第一章', version: 1, graph: { nodes: [{ id: 'start', type: 'subtitle', position: { x: 0, y: 0 }, data: { text: '原文' } }], edges: [] } }] : [] }
  type Write = { where: { status?: string | { in: string[] } }; data: Partial<typeof row> }
  const updateMany = vi.fn(async ({ where, data }: Write) => {
    const matches = !where.status || (typeof where.status === 'string' ? row.status === where.status : where.status.in.includes(row.status))
    if (!matches) return { count: 0 }
    Object.assign(row, data)
    return { count: 1 }
  })
  const transaction = vi.fn<(work: unknown) => Promise<unknown>>()
  const client = {
    $transaction: transaction,
    agentRun: { findUniqueOrThrow: vi.fn(async () => ({ ...row })), findUnique: vi.fn(async () => ({ ...row })), findFirst: vi.fn(async () => ({ ...row })),
      update: vi.fn(async ({ data }: Write) => { Object.assign(row, data); return { ...row } }), updateMany },
    agentConversation: { findUniqueOrThrow: vi.fn(async () => ({ summary: '' })), update: vi.fn() },
    agentMessage: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({ id: 'message' })) },
    agentMemory: { findMany: vi.fn(async () => []), createMany: vi.fn(async () => ({ count: 1 })) },
    storyPatch: { create: vi.fn(async () => ({ id: 'patch' })) },
  }
  transaction.mockImplementation(async (work) => typeof work === 'function'
    ? (work as (tx: typeof client) => Promise<unknown>)(client)
    : Promise.all(work as Promise<unknown>[]))
  const loadSnapshot = vi.fn(async () => snapshot)
  const chat = vi.fn(async () => '项目概览')
  const service = new PrismaAgentRunService(client as unknown as PrismaClient, { loadSnapshot, createProvider: () => ({ chat }) })
  const execute = () => (service as unknown as { executeRun: (job: unknown) => Promise<void> }).executeRun({ id: 'run', secretConfig: { provider: 'fake', model: 'controlled', apiKey: 'not-a-real-key' } }).catch(() => undefined)
  return { row, snapshot, client, loadSnapshot, chat, service, execute }
}

describe('run cancellation boundaries', () => {
  it('still completes local answers and leaves creative patches awaiting author approval', async () => {
    const local = runHarness()
    await local.execute()
    expect(local.row.status).toBe('completed')
    expect(local.chat).not.toHaveBeenCalled()
    expect(local.client.agentMessage.create).toHaveBeenCalledOnce()

    const creative = runHarness('给当前章节增加一个分支，并生成可审批补丁。', 'chapter')
    creative.chat.mockResolvedValue(JSON.stringify({ type: 'final', summary: '待确认草案', plan: ['补充分支'], patch: { operations: [] } }))
    await creative.execute()
    expect(creative.row.status).toBe('awaiting_approval')
    expect(creative.client.storyPatch.create).toHaveBeenCalledOnce()
    expect(creative.client.agentMessage.create).toHaveBeenCalledOnce()
  })

  it('keeps cancellation terminal while the project snapshot is loading', async () => {
    const harness = runHarness()
    const entered = deferred<void>(); const snapshot = deferred<AgentProjectSnapshot>()
    harness.loadSnapshot.mockImplementation(async () => { entered.resolve(); return snapshot.promise })
    const running = harness.execute()
    await entered.promise
    expect((await harness.service.cancelRun('run', 'owner')).status).toBe('cancelled')
    snapshot.resolve(harness.snapshot)
    await running
    expect(harness.row.status).toBe('cancelled')
    expect(harness.client.agentMessage.create).not.toHaveBeenCalled()
    expect(harness.chat).not.toHaveBeenCalled()
  })

  it.each(['late-response', 'abort-error'])('does not turn a cancelled creative request into a local fallback proposal (%s)', async (providerResult) => {
    const harness = runHarness('给当前章节增加一个分支，并生成可审批补丁。', 'chapter')
    const entered = deferred<void>(); const response = deferred<string>()
    harness.chat.mockImplementation(async () => {
      entered.resolve()
      const text = await response.promise
      if (providerResult === 'abort-error') throw new DOMException('Aborted', 'AbortError')
      return text
    })
    const running = harness.execute()
    await entered.promise
    await harness.service.cancelRun('run', 'owner')
    // Some compatible providers finish their current response even after abort.
    response.resolve(JSON.stringify({ type: 'final', summary: '续写正文', plan: [] }))
    await running
    expect(harness.row.status).toBe('cancelled')
    expect(harness.row.timeline).not.toContain('response_fallback')
    expect(harness.client.storyPatch.create).not.toHaveBeenCalled()
    expect(harness.client.agentMessage.create).not.toHaveBeenCalled()
  })

  it('stops after cancellation while suggested memories are being persisted', async () => {
    const harness = runHarness('给当前章节增加一个分支，并生成可审批补丁。', 'chapter')
    harness.chat.mockResolvedValue(JSON.stringify({ type: 'final', summary: '草案', plan: [], patch: { operations: [] }, memorySuggestions: [{ kind: 'plot', title: '线索', content: '雨声来自车站' }] }))
    const entered = deferred<void>(); const saved = deferred<{ count: number }>()
    harness.client.agentMemory.createMany.mockImplementation(async () => { entered.resolve(); return saved.promise })
    const running = harness.execute()
    await entered.promise
    await harness.service.cancelRun('run', 'owner')
    saved.resolve({ count: 1 })
    await running
    expect(harness.row.status).toBe('cancelled')
    expect(harness.client.storyPatch.create).not.toHaveBeenCalled()
    expect(harness.client.agentMessage.create).not.toHaveBeenCalled()
  })

  it('does not cancel a run claimed for applying after the cancellation read', async () => {
    const harness = runHarness()
    harness.row.status = 'awaiting_approval'
    harness.client.agentRun.findFirst.mockImplementationOnce(async () => { const old = { ...harness.row }; harness.row.status = 'applying'; return old })
    await expect(harness.service.cancelRun('run', 'owner')).rejects.toThrow('不可取消')
    expect(harness.row.status).toBe('applying')
  })

  it('does not overwrite a cancellation while handling an execution error', async () => {
    const harness = runHarness()
    harness.row.status = 'drafting'
    harness.client.agentRun.findUnique.mockImplementationOnce(async () => { const old = { ...harness.row }; harness.row.status = 'cancelled'; return old })
    await (harness.service as unknown as { failRun: (id: string, error: Error) => Promise<void> }).failRun('run', new Error('provider failed'))
    expect(harness.row.status).toBe('cancelled')
    expect(harness.client.agentMessage.create).not.toHaveBeenCalled()
  })

  it('persists a visible error for a run that really failed', async () => {
    const harness = runHarness()
    harness.row.status = 'drafting'
    await (harness.service as unknown as { failRun: (id: string, error: Error) => Promise<void> }).failRun('run', new Error('模型暂时不可用'))
    expect(harness.row.status).toBe('failed')
    expect(harness.client.agentMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ content: expect.stringContaining('模型暂时不可用') }) }))
  })
})

describe('RunAbortRegistry', () => {
  it('aborts and releases the controller for a running task', () => {
    const registry = new RunAbortRegistry()
    const controller = registry.create('run')
    expect(controller.signal.aborted).toBe(false)
    expect(registry.abort('run')).toBe(true)
    expect(controller.signal.aborted).toBe(true)
    registry.release('run')
    expect(registry.abort('run')).toBe(false)
  })
})
