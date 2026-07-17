import { applyStoryPatch, createStoryPatchDiff, type StoryGraph } from '@dreamchord/story-domain'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { createProvider, type LLMMessage, type LLMOptions } from '../llm/providers.js'
import { applyPersistedStoryPatch, undoPersistedStoryPatch } from '../story/patchService.js'
import { buildInitialContext, loadAgentProjectSnapshot, type AgentScope } from './context.js'
import { executeConversationalAgent, executeCreativeAgent } from './executor.js'
import { InProcessAgentQueue } from './queue.js'
import { createAgentToolRegistry, toUniformAgentToolRegistry } from './tools.js'
import { buildRollingSummary, createConversationSources, type ConversationMessage } from './conversationMemory.js'
import type { RankableMemory } from './memoryService.js'
import { PrismaAssetService } from '../assets/assetService.js'
import { isImmediateLocalPrompt, runLocalAssistant, shouldUseActionAgent } from './localAssistant.js'

export type AgentRunStatus = 'queued' | 'planning' | 'gathering_context' | 'drafting' | 'validating' | 'awaiting_approval' | 'applying' | 'completed' | 'failed' | 'cancelled'
export interface ProviderSecretConfig { provider: string; model: string; apiKey: string; baseUrl?: string }
export interface AgentPatchDto { id: string; status: string; payload: unknown; validation: unknown; diff: unknown; baseVersion: number; appliedVersion: number | null }
export interface AgentRunDto {
  id: string; status: AgentRunStatus; prompt: string; scope: string; targetId: string | null; provider: string; model: string
  plan: string[]; timeline: unknown[]; sources: unknown[]; validation: unknown; errorCode: string | null; errorMessage: string | null
  patch: AgentPatchDto | null; createdAt: string; updatedAt: string; completedAt: string | null
}
export interface ConversationDto { id: string; title: string; scope: string; createdAt: string; updatedAt: string }
export interface CreateAgentRunInput {
  projectId: string; conversationId: string; chapterId?: string; prompt: string; scope: AgentScope; targetId?: string; providerConfig: ProviderSecretConfig
}
export interface AgentRunService {
  listConversations(projectId: string, userId: string): Promise<ConversationDto[]>
  createConversation(projectId: string, userId: string, input: { title: string; scope: AgentScope }): Promise<ConversationDto>
  createRun(input: CreateAgentRunInput, userId: string): Promise<AgentRunDto>
  getRun(runId: string, userId: string): Promise<AgentRunDto>
  cancelRun(runId: string, userId: string): Promise<AgentRunDto>
  rejectRun(runId: string, userId: string): Promise<AgentRunDto>
  retryRun(runId: string, userId: string, providerConfig: ProviderSecretConfig): Promise<AgentRunDto>
  applyRun(runId: string, userId: string): Promise<{ chapterId: string; version: number; graph: StoryGraph }>
  undoRun(runId: string, userId: string): Promise<{ chapterId: string; version: number; graph: StoryGraph }>
}

interface AgentQueueJob { id: string; secretConfig?: ProviderSecretConfig }
interface AgentRunDependencies {
  loadSnapshot: (projectId: string) => Promise<Awaited<ReturnType<typeof loadAgentProjectSnapshot>>>
  createProvider: (provider: string, config: ProviderSecretConfig) => { chat: (messages: LLMMessage[], options?: LLMOptions) => Promise<string> }
}
const ACTIVE_STATUSES: AgentRunStatus[] = ['queued', 'planning', 'gathering_context', 'drafting', 'validating']

export class RunAbortRegistry {
  private readonly controllers = new Map<string, AbortController>()
  create(runId: string): AbortController { const controller = new AbortController(); this.controllers.set(runId, controller); return controller }
  abort(runId: string): boolean { const controller = this.controllers.get(runId); if (!controller) return false; controller.abort(); return true }
  release(runId: string): void { this.controllers.delete(runId) }
}

function parseJson(raw: string, fallback: unknown): unknown { try { return JSON.parse(raw) } catch { return fallback } }
function iso(value: Date): string { return value.toISOString() }

export class PrismaAgentRunService implements AgentRunService {
  private readonly queue: InProcessAgentQueue<AgentQueueJob>
  private readonly aborts = new RunAbortRegistry()
  private readonly dependencies: AgentRunDependencies
  constructor(private readonly client: PrismaClient = prisma, dependencies: Partial<AgentRunDependencies> = {}) {
    this.dependencies = {
      loadSnapshot: dependencies.loadSnapshot ?? ((projectId) => loadAgentProjectSnapshot(projectId, this.client)),
      createProvider: dependencies.createProvider ?? createProvider,
    }
    this.queue = new InProcessAgentQueue((job) => this.executeRun(job), (job, error) => { void this.failRun(job.id, error) })
  }

  async recoverInterruptedRuns(): Promise<void> {
    await this.client.agentRun.updateMany({ where: { status: { in: ACTIVE_STATUSES } }, data: { status: 'failed', errorCode: 'server-restarted', errorMessage: '服务重启，任务已安全停止' } })
  }

  async listConversations(projectId: string, userId: string): Promise<ConversationDto[]> {
    const rows = await this.client.agentConversation.findMany({ where: { projectId, userId }, orderBy: { updatedAt: 'desc' } })
    return rows.map((row) => ({ id: row.id, title: row.title, scope: row.scope, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }))
  }

  async createConversation(projectId: string, userId: string, input: { title: string; scope: AgentScope }): Promise<ConversationDto> {
    await this.requireProjectOwner(projectId, userId)
    const row = await this.client.agentConversation.create({ data: { projectId, userId, title: input.title, scope: input.scope } })
    return { id: row.id, title: row.title, scope: row.scope, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }
  }

  async createRun(input: CreateAgentRunInput, userId: string): Promise<AgentRunDto> {
    await this.requireProjectOwner(input.projectId, userId)
    const conversation = await this.client.agentConversation.findFirst({ where: { id: input.conversationId, projectId: input.projectId, userId } })
    if (!conversation) throw new Error('会话不存在')
    const run = await this.client.agentRun.create({ data: {
      status: 'queued', prompt: input.prompt, scope: input.scope, targetId: input.targetId,
      provider: input.providerConfig.provider, model: input.providerConfig.model, userId, projectId: input.projectId,
      chapterId: input.chapterId, conversationId: input.conversationId,
    } })
    await this.client.agentMessage.create({ data: { conversationId: input.conversationId, role: 'user', content: input.prompt } })
    this.queue.enqueue({ id: run.id, secretConfig: input.providerConfig })
    return this.getRun(run.id, userId)
  }

  async getRun(runId: string, userId: string): Promise<AgentRunDto> {
    const run = await this.client.agentRun.findFirst({ where: { id: runId, userId }, include: { patch: true } })
    if (!run) throw new Error('Agent 任务不存在')
    return {
      id: run.id, status: run.status as AgentRunStatus, prompt: run.prompt, scope: run.scope, targetId: run.targetId,
      provider: run.provider, model: run.model, plan: parseJson(run.plan, []) as string[], timeline: parseJson(run.timeline, []) as unknown[],
      sources: parseJson(run.sources, []) as unknown[], validation: parseJson(run.validation, {}), errorCode: run.errorCode, errorMessage: run.errorMessage,
      patch: run.patch ? { id: run.patch.id, status: run.patch.status, payload: parseJson(run.patch.payload, {}), validation: parseJson(run.patch.validation, {}), diff: parseJson(run.patch.diff, {}), baseVersion: run.patch.baseVersion, appliedVersion: run.patch.appliedVersion } : null,
      createdAt: iso(run.createdAt), updatedAt: iso(run.updatedAt), completedAt: run.completedAt ? iso(run.completedAt) : null,
    }
  }

  async cancelRun(runId: string, userId: string): Promise<AgentRunDto> { return this.stopRun(runId, userId) }
  async rejectRun(runId: string, userId: string): Promise<AgentRunDto> { return this.stopRun(runId, userId) }
  async retryRun(runId: string, userId: string, providerConfig: ProviderSecretConfig): Promise<AgentRunDto> {
    const old = await this.client.agentRun.findFirst({ where: { id: runId, userId } })
    if (!old) throw new Error('Agent 任务不存在')
    return this.createRun({ projectId: old.projectId, conversationId: old.conversationId, chapterId: old.chapterId ?? undefined, prompt: old.prompt, scope: old.scope as AgentScope, targetId: old.targetId ?? undefined, providerConfig }, userId)
  }
  async applyRun(runId: string, userId: string) {
    const run = await this.client.agentRun.findFirst({ where: { id: runId, userId }, include: { patch: true } })
    if (!run?.patch || run.status !== 'awaiting_approval') throw new Error('任务当前不可应用')
    const claimed = await this.client.agentRun.updateMany({
      where: { id: runId, status: 'awaiting_approval' },
      data: { status: 'applying', errorCode: null, errorMessage: null },
    })
    if (claimed.count !== 1) throw new Error('任务当前不可应用')
    try {
      const applied = await applyPersistedStoryPatch({ patchId: run.patch.id, userId }, this.client)
      await this.client.agentMemory.create({ data: {
        projectId: run.projectId, userId, conversationId: run.conversationId, kind: 'artifact', status: 'active',
        title: `已应用剧情变更：章节 ${applied.chapterId}`, content: `剧情补丁 ${run.patch.id} 已应用，章节版本更新为 ${applied.version}。`,
        tags: JSON.stringify(['story-patch', applied.chapterId]), importance: 70, sourceType: 'editor', sourceId: run.patch.id,
      } }).catch(() => undefined)
      return applied
    } catch (error) {
      await this.client.agentRun.updateMany({
        where: { id: runId, status: 'applying' },
        data: {
          status: 'awaiting_approval',
          errorCode: 'apply-failed',
          errorMessage: error instanceof Error ? error.message : '补丁应用失败',
        },
      })
      throw error
    }
  }
  async undoRun(runId: string, userId: string) {
    const run = await this.client.agentRun.findFirst({ where: { id: runId, userId }, include: { patch: true } })
    if (!run?.patch) throw new Error('任务没有可撤销补丁')
    return undoPersistedStoryPatch({ patchId: run.patch.id, userId }, this.client)
  }

  private async requireProjectOwner(projectId: string, userId: string): Promise<void> {
    const project = await this.client.project.findUnique({ where: { id: projectId }, select: { authorId: true } })
    if (!project) throw new Error('项目不存在')
    if (project.authorId !== userId) throw new Error('无权访问此项目')
  }
  private async stopRun(runId: string, userId: string): Promise<AgentRunDto> {
    const run = await this.client.agentRun.findFirst({ where: { id: runId, userId } })
    if (!run) throw new Error('Agent 任务不存在')
    if (![...ACTIVE_STATUSES, 'awaiting_approval'].includes(run.status as AgentRunStatus)) throw new Error('任务当前不可取消')
    await this.client.agentRun.update({ where: { id: runId }, data: { status: 'cancelled', completedAt: new Date() } })
    this.aborts.abort(runId)
    return this.getRun(runId, userId)
  }
  private async appendTimeline(runId: string, event: unknown): Promise<void> {
    const run = await this.client.agentRun.findUniqueOrThrow({ where: { id: runId }, select: { timeline: true } })
    const timeline = parseJson(run.timeline, []) as unknown[]
    timeline.push({ ...event as object, at: new Date().toISOString() })
    await this.client.agentRun.update({ where: { id: runId }, data: { timeline: JSON.stringify(timeline) } })
  }
  private async executeRun(job: AgentQueueJob): Promise<void> {
    const controller = this.aborts.create(job.id)
    try {
      await this.executeRunWithSignal(job, controller.signal)
    } finally {
      this.aborts.release(job.id)
    }
  }
  private async executeRunWithSignal(job: AgentQueueJob, signal: AbortSignal): Promise<void> {
    if (!job.secretConfig) throw new Error('模型密钥已释放')
    const run = await this.client.agentRun.findUniqueOrThrow({ where: { id: job.id } })
    if (run.status === 'cancelled') return
    await this.client.agentRun.update({ where: { id: run.id }, data: { status: 'planning' } })
    const snapshot = await this.dependencies.loadSnapshot(run.projectId)
    if (!snapshot) throw new Error('项目上下文不存在')
    await this.client.agentRun.update({ where: { id: run.id }, data: { status: 'gathering_context' } })
    const contextRequest = run.chapterId
      ? { scope: run.scope as AgentScope, chapterId: run.chapterId, targetId: run.targetId ?? undefined }
      : { scope: 'project' as const }
    const initialContext = [
      ...buildInitialContext(snapshot, contextRequest),
      ...await this.loadConversationSources(run.conversationId, run.projectId, run.prompt),
    ]
    await this.client.agentRun.update({ where: { id: run.id }, data: { sources: JSON.stringify(initialContext), status: 'drafting' } })
    const rawTools = createAgentToolRegistry({
      snapshot, chapterId: run.chapterId ?? undefined, conversationContext: initialContext.filter((source) => source.kind === 'conversation-history' || source.kind === 'conversation-summary'),
      memories: initialContext.filter((source) => source.kind === 'memory').map((source) => ({ id: source.id, title: source.title, content: source.content })),
      inspectAsset: (assetId) => new PrismaAssetService(this.client).inspect(assetId, run.userId),
      prepareAsset: (assetId, purpose, recipe) => new PrismaAssetService(this.client).process(assetId, run.userId, { purpose, ...recipe }),
    })
    let result
    if (job.secretConfig.provider === 'local' || isImmediateLocalPrompt(run.prompt)) {
      result = await runLocalAssistant({
        prompt: run.prompt,
        snapshot,
        chapterId: run.chapterId ?? undefined,
        scope: run.scope as AgentScope,
        targetId: run.targetId ?? undefined,
        contextSources: initialContext.filter((source) => source.kind === 'conversation-history' || source.kind === 'conversation-summary' || source.kind === 'memory'),
      })
    } else {
      const provider = this.dependencies.createProvider(job.secretConfig.provider, job.secretConfig)
      const execute = shouldUseActionAgent(run.prompt, Boolean(run.chapterId)) ? executeCreativeAgent : executeConversationalAgent
      result = await execute({
        prompt: run.prompt, initialContext, tools: toUniformAgentToolRegistry(rawTools),
        chat: (messages) => provider.chat(messages, { temperature: 0.7, maxTokens: 4096, signal }),
        onEvent: (event) => this.appendTimeline(run.id, event),
      })
    }
    if (result.memorySuggestions.length > 0) {
      await this.client.agentMemory.createMany({ data: result.memorySuggestions.map((memory) => ({
        projectId: run.projectId, userId: run.userId, conversationId: run.conversationId, kind: memory.kind,
        status: 'suggested', title: memory.title, content: memory.content, tags: JSON.stringify(memory.tags ?? []),
        importance: memory.importance ?? 50, sourceType: 'assistant', sourceId: run.id,
      })) })
    }
    await this.client.agentRun.update({ where: { id: run.id }, data: { status: 'validating', plan: JSON.stringify(result.plan) } })
    if (!result.patch) {
      await this.client.agentMessage.create({ data: { conversationId: run.conversationId, role: 'assistant', content: result.summary, metadata: JSON.stringify({ runId: run.id, artifactRefs: result.artifactRefs }) } })
      await this.refreshConversationSummary(run.conversationId)
      await this.client.agentRun.updateMany({ where: { id: run.id, status: 'validating' }, data: { status: 'completed', completedAt: new Date() } })
      return
    }
    if (!run.chapterId) throw new Error('请选择章节后再修改剧情')
    const chapter = snapshot.chapters.find((item) => item.id === run.chapterId)
    if (!chapter) throw new Error('所选章节不存在')
    let sequence = 0
    const preview = applyStoryPatch(chapter.graph, result.patch, () => `preview-${sequence++}`)
    if (!preview.validation.valid) throw new Error('Agent 补丁未通过图结构校验')
    await this.client.storyPatch.create({ data: { runId: run.id, projectId: run.projectId, chapterId: chapter.id, baseVersion: chapter.version, payload: JSON.stringify(result.patch), validation: JSON.stringify(preview.validation), diff: JSON.stringify(createStoryPatchDiff(chapter.graph, preview.graph)) } })
    await this.client.agentMessage.create({ data: { conversationId: run.conversationId, role: 'assistant', content: result.summary, metadata: JSON.stringify({ runId: run.id, artifactRefs: result.artifactRefs }) } })
    await this.refreshConversationSummary(run.conversationId)
    await this.client.agentRun.updateMany({ where: { id: run.id, status: 'validating' }, data: { status: 'awaiting_approval', validation: JSON.stringify(preview.validation) } })
  }
  private async loadConversationSources(conversationId: string, projectId: string, query: string) {
    const [conversation, messageRows, memoryRows] = await Promise.all([
      this.client.agentConversation.findUniqueOrThrow({ where: { id: conversationId }, select: { summary: true } }),
      this.client.agentMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 31 }),
      this.client.agentMemory.findMany({ where: { projectId, status: 'active', OR: [{ conversationId: null }, { conversationId }] } }),
    ])
    const messages: ConversationMessage[] = messageRows.reverse()
    if (messages.at(-1)?.role === 'user' && messages.at(-1)?.content === query) messages.pop()
    const memories: RankableMemory[] = memoryRows.map((memory) => ({
      id: memory.id, kind: memory.kind as RankableMemory['kind'], title: memory.title, content: memory.content,
      tags: parseJson(memory.tags, []) as string[], importance: memory.importance, status: memory.status as RankableMemory['status'],
      isPinned: memory.isPinned, sourceType: memory.sourceType, conversationId: memory.conversationId,
      supersededById: memory.supersededById, updatedAt: memory.updatedAt,
    }))
    return createConversationSources({ summary: conversation.summary, messages, memories, query, conversationId })
  }
  private async refreshConversationSummary(conversationId: string): Promise<void> {
    const messages = await this.client.agentMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
    const rolling = buildRollingSummary(messages)
    if (!rolling) return
    await this.client.agentConversation.update({ where: { id: conversationId }, data: { summary: rolling.summary, summaryThroughMessageId: rolling.throughMessageId } })
  }
  private async failRun(runId: string, error: unknown): Promise<void> {
    const current = await this.client.agentRun.findUnique({ where: { id: runId }, select: { status: true, conversationId: true } }).catch(() => null)
    if (current?.status === 'cancelled') return
    const message = (error instanceof Error ? error.message : 'Agent 执行失败').slice(0, 1_000)
    if (current?.conversationId) {
      await this.client.$transaction([
        this.client.agentRun.update({ where: { id: runId }, data: { status: 'failed', errorCode: error instanceof Error && 'code' in error ? String(error.code) : 'agent-failed', errorMessage: message, completedAt: new Date() } }),
        this.client.agentMessage.create({ data: {
          conversationId: current.conversationId,
          role: 'assistant',
          content: `这次没有完成：${message}\n\n项目内容没有被修改。你可以直接换一种说法重试，或检查模型设置后继续。`,
          metadata: JSON.stringify({ runId, error: true, artifactRefs: [] }),
        } }),
      ]).catch(() => undefined)
      return
    }
    await this.client.agentRun.update({ where: { id: runId }, data: { status: 'failed', errorCode: error instanceof Error && 'code' in error ? String(error.code) : 'agent-failed', errorMessage: message, completedAt: new Date() } }).catch(() => undefined)
  }
}

export const prismaAgentRunService = new PrismaAgentRunService()
