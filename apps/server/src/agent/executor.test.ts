import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
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

  it('normalizes a single ids alias for a single-asset tool', async () => {
    const execute = vi.fn(async (input: unknown) => input)
    const chat = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({ type: 'tool_call', tool: 'inspect_asset', input: { ids: ['asset-1'] } }))
      .mockResolvedValueOnce(JSON.stringify({ type: 'final', summary: '素材已检查', plan: [] }))
    const tools: UniformAgentToolRegistry = {
      inspect_asset: {
        parseInput: (value) => z.object({ assetId: z.string() }).strict().parse(value),
        execute,
      },
    }

    const result = await executeCreativeAgent({ prompt: '检查素材', initialContext: [], chat, tools })

    expect(execute).toHaveBeenCalledWith({ assetId: 'asset-1' })
    expect(result.toolSteps).toBe(1)
  })

  it('asks for corrected tool input when multiple ids cannot be normalized', async () => {
    const execute = vi.fn(async (input: unknown) => input)
    const onEvent = vi.fn()
    const chat = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({ type: 'tool_call', tool: 'inspect_asset', input: { ids: ['asset-1', 'asset-2'] } }))
      .mockResolvedValueOnce(JSON.stringify({ type: 'tool_call', tool: 'inspect_asset', input: { assetId: 'asset-1' } }))
      .mockResolvedValueOnce(JSON.stringify({ type: 'final', summary: '已逐个检查', plan: [] }))
    const tools: UniformAgentToolRegistry = {
      inspect_asset: {
        parseInput: (value) => z.object({ assetId: z.string() }).strict().parse(value),
        execute,
      },
    }

    const result = await executeCreativeAgent({ prompt: '检查素材', initialContext: [], chat, tools, onEvent })

    expect(onEvent).toHaveBeenCalledWith({ type: 'tool_input_repair', tool: 'inspect_asset' })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({ assetId: 'asset-1' })
    expect(result.toolSteps).toBe(1)
    const repairMessage = chat.mock.calls[1]?.[0]?.at(-1)?.content ?? ''
    expect(repairMessage).toContain('assetId')
    expect(repairMessage).not.toContain('invalid_type')
  })
})
