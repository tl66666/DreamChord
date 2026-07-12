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
  type: 'tool_started' | 'tool_completed' | 'format_repair' | 'tool_input_repair'
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

const SINGLE_ASSET_TOOLS = new Set<AgentToolName>([
  'inspect_asset',
  'prepare_character_asset',
  'prepare_cg_asset',
  'prepare_background_asset',
])

function normalizeToolInput(tool: AgentToolName, value: unknown): unknown {
  if (!SINGLE_ASSET_TOOLS.has(tool) || !value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  if (typeof record.assetId === 'string' || !Array.isArray(record.ids) || record.ids.length !== 1 || typeof record.ids[0] !== 'string') return value
  const { ids: _ids, ...rest } = record
  return { ...rest, assetId: record.ids[0] }
}

function toolInputHint(tool: AgentToolName): string {
  if (tool === 'inspect_asset' || tool === 'prepare_background_asset') return '{"assetId":"素材ID"}'
  if (tool === 'prepare_character_asset') return '{"assetId":"素材ID","removeWhite":true,"trim":true}'
  if (tool === 'prepare_cg_asset') return '{"assetId":"素材ID","trim":true}'
  return '请严格使用该工具定义的字段和类型，不要增加其他字段'
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
    { role: 'user', content: `${input.prompt}\n\n已提供上下文：\n${JSON.stringify(input.initialContext)}` },
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
      if (formatRepairs >= 2) throw error
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
