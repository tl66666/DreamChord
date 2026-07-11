import { describe, expect, it, vi } from 'vitest'
import { executeCreativeAgent, StepLimitExceededError, type UniformAgentToolRegistry } from './executor.js'

function registry(execute = vi.fn(async () => ({ issues: [] }))): UniformAgentToolRegistry {
  return {
    analyze_story_graph: { parseInput: (value) => value, execute },
  }
}

describe('creative agent executor', () => {
  it('executes a requested tool and returns a structured final result', async () => {
    const responses = [
      JSON.stringify({ type: 'tool_call', tool: 'analyze_story_graph', input: {} }),
      JSON.stringify({ type: 'final', summary: '结构正常', plan: ['检查结构'], patch: { operations: [] } }),
    ]
    const chat = vi.fn(async () => responses.shift() ?? '')
    const tool = vi.fn(async () => ({ issues: [] }))

    const result = await executeCreativeAgent({ prompt: '检查剧情', initialContext: [], chat, tools: registry(tool) })

    expect(tool).toHaveBeenCalledOnce()
    expect(result.summary).toBe('结构正常')
    expect(result.patch).toEqual({ operations: [] })
    expect(chat).toHaveBeenCalledTimes(2)
  })

  it('stops before a ninth tool call', async () => {
    const chat = vi.fn(async () => JSON.stringify({ type: 'tool_call', tool: 'analyze_story_graph', input: {} }))

    await expect(executeCreativeAgent({ prompt: '循环', initialContext: [], chat, tools: registry() }))
      .rejects.toBeInstanceOf(StepLimitExceededError)
    expect(chat).toHaveBeenCalledTimes(8)
  })
})
