import type { StoryPatch } from '@dreamchord/story-domain'
import type { LLMMessage } from '../llm/providers.js'
import type { AgentContextSource } from './context.js'
import { parseAgentModelResponse } from './protocol.js'
import type { AgentToolName } from './tools.js'

export interface UniformAgentTool {
  parseInput(value: unknown): unknown
  execute(input: unknown): Promise<unknown>
}
export type UniformAgentToolRegistry = Partial<Record<AgentToolName, UniformAgentTool>>

export interface AgentExecutionEvent {
  type: 'tool_started' | 'tool_completed' | 'format_repair' | 'tool_input_repair' | 'response_fallback'
  tool?: AgentToolName
}

export interface AgentExecutionResult {
  summary: string
  plan: string[]
  patch?: StoryPatch
  suggestions: string[]
  memorySuggestions: Array<{ kind: 'canon' | 'character' | 'preference' | 'plot' | 'decision' | 'artifact'; title: string; content: string; tags?: string[]; importance?: number }>
  artifactRefs: Array<{ type: 'story-patch' | 'asset-variant'; id: string }>
  toolSteps: number
}

export class StepLimitExceededError extends Error {
  readonly code = 'step-limit-exceeded'
  constructor() { super('Agent 已达到 8 步工具调用限制') }
}

const SYSTEM_PROMPT = `你是 DreamChord 创作 Agent。你只能返回 JSON，不能返回解释或 markdown。
需要读取信息时返回 {"type":"tool_call","tool":"允许的工具名","input":{}}。
完成时返回 {"type":"final","summary":"结论","plan":["步骤"],"patch":{"operations":[]},"suggestions":[]}。
单素材工具每次只能处理一个素材，参数示例：inspect_asset 使用 {"assetId":"素材ID"}；prepare_character_asset 使用 {"assetId":"素材ID","removeWhite":true,"trim":true}；prepare_cg_asset 使用 {"assetId":"素材ID","trim":true}；prepare_background_asset 使用 {"assetId":"素材ID"}。
不得编造工具，不得要求直接访问数据库或文件系统。
处理图片前必须先调用 inspect_asset。透明 PNG 不要去白底；只有 flat-light 才可使用边缘连通去白底；complex 复杂背景必须说明本地工具不能可靠语义抠图，建议透明 PNG 或纯色底原图。所有 prepare 工具只生成待用户确认的候选产物。`

const CONVERSATION_SYSTEM_PROMPT = `你是 DreamChord 项目内的创作 Agent。请直接、自然、准确地回答用户，不要把普通问题理解成修改故事。
你已经收到当前项目、最近对话和记忆上下文。信息足够时直接返回中文自然文本，不要包 JSON 或 Markdown 代码块。
只有确实需要补充项目事实时，才返回一个 JSON 工具调用：{"type":"tool_call","tool":"读取类工具名","input":{}}。
读取工具结果后继续自然回答。对话模式禁止生成 story patch、禁止调用素材处理工具、禁止声称已经修改项目。用户要求创作但没有绑定章节时，可以给出可用的文字草稿或构思，并提醒绑定章节后才能形成可审批修改。`

const CONVERSATION_TOOLS = new Set<AgentToolName>([
  'read_project_brief', 'read_chapter_outline', 'read_scene', 'search_story',
  'read_conversation_context', 'search_memories', 'list_project_assets', 'inspect_asset',
  'read_character_profile', 'analyze_story_graph',
])

const SINGLE_ASSET_TOOLS = new Set<AgentToolName>([
  'inspect_asset',
  'prepare_character_asset',
  'prepare_cg_asset',
  'prepare_background_asset',
])
const PLAYABLE_SCENE_REQUEST = /(?:根据|利用|使用)?.*(?:素材库|素材)?.*(?:创建|新建|搭建|生成|写一段).*(?:可运行|可播放|剧情场景|场景|剧情)/i

function creativeTaskInstruction(prompt: string): string {
  if (!PLAYABLE_SCENE_REQUEST.test(prompt)) return ''
  return '\n\n这是“素材驱动的可播放场景”任务。必须先调用 list_project_assets，并根据需要读取角色或章节；只能引用工具返回的素材 URL、角色 ID 和设定。随后必须通过 create_story_patch 组织背景、角色登场、至少一段可播放文本及连线，再调用 validate_story_patch。最终只提交可审阅草案，绝不能声称已经写入章节。'
}

function normalizeToolInput(tool: AgentToolName, value: unknown): unknown {
  if (!SINGLE_ASSET_TOOLS.has(tool) || !value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  if (typeof record.assetId === 'string' || !Array.isArray(record.ids) || record.ids.length !== 1 || typeof record.ids[0] !== 'string') return value
  const normalized: Record<string, unknown> = { ...record, assetId: record.ids[0] }
  delete normalized.ids
  return normalized
}

function toolInputHint(tool: AgentToolName): string {
  if (tool === 'inspect_asset' || tool === 'prepare_background_asset') return '{"assetId":"素材ID"}'
  if (tool === 'prepare_character_asset') return '{"assetId":"素材ID","removeWhite":true,"trim":true}'
  if (tool === 'prepare_cg_asset') return '{"assetId":"素材ID","trim":true}'
  return '请严格使用该工具定义的字段和类型，不要增加其他字段'
}

function readableFallback(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[') || /^```(?:json)?\b/i.test(trimmed)) return null
  return trimmed.slice(0, 10_000)
}

function conversationResult(summary: string, plan: string[] = ['结合当前对话与项目上下文回答']): AgentExecutionResult {
  return { summary, plan, suggestions: [], memorySuggestions: [], artifactRefs: [], toolSteps: 0 }
}

export async function executeConversationalAgent(input: {
  prompt: string
  initialContext: AgentContextSource[]
  chat: (messages: LLMMessage[]) => Promise<string>
  tools: UniformAgentToolRegistry
  onEvent?: (event: AgentExecutionEvent) => void | Promise<void>
}): Promise<AgentExecutionResult> {
  const messages: LLMMessage[] = [
    { role: 'system', content: CONVERSATION_SYSTEM_PROMPT },
    { role: 'user', content: `${input.prompt}\n\n当前项目与对话上下文：\n${JSON.stringify(input.initialContext)}` },
  ]
  let toolSteps = 0
  let formatRepairs = 0

  while (toolSteps < 6) {
    const raw = await input.chat(messages)
    const natural = readableFallback(raw)
    if (natural) return { ...conversationResult(natural), toolSteps }

    let response
    try {
      response = parseAgentModelResponse(raw)
    } catch (error) {
      if (formatRepairs >= 1) throw error
      formatRepairs += 1
      await input.onEvent?.({ type: 'format_repair' })
      messages.push({ role: 'assistant', content: raw.slice(0, 2_000) })
      messages.push({ role: 'user', content: '刚才的内容无法读取。请直接用自然中文回答；如需读取项目，再返回合法的 tool_call JSON。' })
      continue
    }

    if (response.type === 'final') {
      return {
        summary: response.summary,
        plan: response.plan,
        suggestions: response.suggestions ?? [],
        memorySuggestions: [],
        artifactRefs: [],
        toolSteps,
      }
    }

    if (!CONVERSATION_TOOLS.has(response.tool)) {
      messages.push({ role: 'assistant', content: JSON.stringify(response) })
      messages.push({ role: 'user', content: `对话模式不能调用 ${response.tool}。请改为自然文本回答；需要修改时提醒用户绑定章节或进入审批流程。` })
      toolSteps += 1
      continue
    }
    const tool = input.tools[response.tool]
    if (!tool) throw new Error(`读取工具未注册: ${response.tool}`)
    const parsedInput = tool.parseInput(normalizeToolInput(response.tool, response.input))
    await input.onEvent?.({ type: 'tool_started', tool: response.tool })
    const toolResult = await tool.execute(parsedInput)
    await input.onEvent?.({ type: 'tool_completed', tool: response.tool })
    toolSteps += 1
    messages.push({ role: 'assistant', content: JSON.stringify(response) })
    messages.push({ role: 'user', content: JSON.stringify({ type: 'tool_result', tool: response.tool, result: toolResult }).slice(0, 20_000) })
  }

  throw new StepLimitExceededError()
}

export async function executeCreativeAgent(input: {
  prompt: string
  initialContext: AgentContextSource[]
  chat: (messages: LLMMessage[]) => Promise<string>
  tools: UniformAgentToolRegistry
  onEvent?: (event: AgentExecutionEvent) => void | Promise<void>
}): Promise<AgentExecutionResult> {
  const messages: LLMMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${input.prompt}${creativeTaskInstruction(input.prompt)}\n\n已提供上下文：\n${JSON.stringify(input.initialContext)}` },
  ]
  let toolSteps = 0
  let formatRepairs = 0
  let toolInputRepairs = 0

  while (toolSteps < 8) {
    const raw = await input.chat(messages)
    let response
    try {
      response = parseAgentModelResponse(raw)
    } catch (error) {
      if (formatRepairs >= 2) {
        const fallback = readableFallback(raw)
        if (!fallback) throw error
        await input.onEvent?.({ type: 'response_fallback' })
        return {
          summary: fallback,
          plan: ['转为安全对话答复'],
          suggestions: [],
          memorySuggestions: [],
          artifactRefs: [],
          toolSteps,
        }
      }
      formatRepairs += 1
      await input.onEvent?.({ type: 'format_repair' })
      messages.push({ role: 'assistant', content: raw.slice(0, 2_000) })
      messages.push({ role: 'user', content: '上一个响应不符合 JSON 协议。请只返回合法的 tool_call 或 final JSON。' })
      continue
    }

    if (response.type === 'final') {
      return {
        summary: response.summary,
        plan: response.plan,
        patch: response.patch,
        suggestions: response.suggestions ?? [],
        memorySuggestions: response.memorySuggestions ?? [],
        artifactRefs: response.artifactRefs ?? [],
        toolSteps,
      }
    }

    const tool = input.tools[response.tool]
    if (!tool) throw new Error(`工具未注册: ${response.tool}`)
    let parsedInput: unknown
    try {
      parsedInput = tool.parseInput(normalizeToolInput(response.tool, response.input))
    } catch {
      if (toolInputRepairs >= 2) throw new Error(`工具 ${response.tool} 的参数连续无效，请检查参数后重试`)
      toolInputRepairs += 1
      await input.onEvent?.({ type: 'tool_input_repair', tool: response.tool })
      messages.push({ role: 'assistant', content: JSON.stringify(response).slice(0, 2_000) })
      messages.push({
        role: 'user',
        content: `工具 ${response.tool} 的参数不正确。正确示例：${toolInputHint(response.tool)}。单素材工具一次只能传一个 assetId，请修正后重新调用。`,
      })
      continue
    }
    await input.onEvent?.({ type: 'tool_started', tool: response.tool })
    const result = await tool.execute(parsedInput)
    await input.onEvent?.({ type: 'tool_completed', tool: response.tool })
    toolSteps += 1
    messages.push({ role: 'assistant', content: JSON.stringify(response) })
    messages.push({ role: 'user', content: JSON.stringify({ type: 'tool_result', tool: response.tool, result }).slice(0, 20_000) })
  }

  throw new StepLimitExceededError()
}
