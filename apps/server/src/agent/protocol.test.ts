import { describe, expect, it } from 'vitest'
import { parseAgentModelResponse } from './protocol.js'

describe('agent model protocol', () => {
  it('parses a fenced tool call with an allowed tool', () => {
    const response = parseAgentModelResponse('```json\n{"type":"tool_call","tool":"analyze_story_graph","input":{}}\n```')
    expect(response).toEqual({ type: 'tool_call', tool: 'analyze_story_graph', input: {} })
  })

  it('rejects unregistered tools', () => {
    expect(() => parseAgentModelResponse('{"type":"tool_call","tool":"run_shell","input":{}}')).toThrow('模型响应格式不正确')
  })
})
