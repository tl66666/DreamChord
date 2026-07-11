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
  type: 'tool_started' | 'tool_completed' | 'format_repair'
  tool?: AgentToolName
}

export interface AgentExecutionResult {
  summary: string
  plan: string[]
  patch?: StoryPatch
  suggestions: string[]
  toolSteps: number
}

export class StepLimitExceededError extends Error {
  readonly code = 'step-limit-exceeded'
  constructor() { super('Agent 已达到 8 步工具调用限制') }
}

const SYSTEM_PROMPT = `你是 DreamChord 创作 Agent。你只能返回 JSON，不能返回解释或 markdown。
需要读取信息时返回 {"type":"tool_call","tool":"允许的工具名","input":{}}。
完成时返回 {"type":"final","summary":"结论","plan":["步骤"],"patch":{"operations":[]},"suggestions":[]}。
不得编造工具，不得要求直接访问数据库或文件系统。`

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
        toolSteps,
      }
    }

    const tool = input.tools[response.tool]
    if (!tool) throw new Error(`工具未注册: ${response.tool}`)
    const parsedInput = tool.parseInput(response.input)
    await input.onEvent?.({ type: 'tool_started', tool: response.tool })
    const result = await tool.execute(parsedInput)
    await input.onEvent?.({ type: 'tool_completed', tool: response.tool })
    toolSteps += 1
    messages.push({ role: 'assistant', content: JSON.stringify(response) })
    messages.push({ role: 'user', content: JSON.stringify({ type: 'tool_result', tool: response.tool, result }).slice(0, 20_000) })
  }

  throw new StepLimitExceededError()
}
