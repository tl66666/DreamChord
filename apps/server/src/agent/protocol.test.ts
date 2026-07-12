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

  it('accepts bounded memory suggestions and rejects unknown kinds', () => {
    const valid = parseAgentModelResponse(JSON.stringify({ type: 'final', summary: '完成', plan: [], memorySuggestions: [{ kind: 'plot', title: '门后', content: '门后是旧车站', importance: 80 }] }))
    expect(valid.type === 'final' && valid.memorySuggestions?.[0]?.kind).toBe('plot')
    expect(() => parseAgentModelResponse(JSON.stringify({ type: 'final', summary: '完成', plan: [], memorySuggestions: [{ kind: 'secret-kind', title: 'x', content: 'y' }] }))).toThrow('模型响应格式不正确')
  })

  it('normalizes null optional fields from common compatible providers', () => {
    const response = parseAgentModelResponse(JSON.stringify({
      type: 'final',
      summary: '你好，我可以帮你一起完善这个故事。',
      plan: null,
      patch: null,
      suggestions: null,
    }))

    expect(response).toEqual({
      type: 'final',
      summary: '你好，我可以帮你一起完善这个故事。',
      plan: [],
    })
  })

  it('extracts a single JSON response surrounded by a short explanation', () => {
    const response = parseAgentModelResponse([
      '这是结果：',
      '```json',
      '{"type":"final","summary":"项目状态正常","plan":[]}',
      '```',
      '以上是本次检查。',
    ].join('\n'))

    expect(response).toEqual({ type: 'final', summary: '项目状态正常', plan: [] })
  })
})
