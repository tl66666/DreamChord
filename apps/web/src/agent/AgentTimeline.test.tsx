// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import AgentTimeline from './AgentTimeline'
import type { AgentRunDto } from './agentTypes'

function run(overrides: Partial<AgentRunDto> = {}): AgentRunDto {
  return {
    id: 'run', status: 'completed', prompt: '你好', scope: 'project', targetId: null,
    provider: 'glm', model: 'glm-4.7-flash', plan: [], timeline: [], sources: [], validation: {},
    errorCode: null, errorMessage: null, patch: null, createdAt: '', updatedAt: '', completedAt: '',
    ...overrides,
  }
}

describe('AgentTimeline', () => {
  afterEach(cleanup)

  it('renders recovery events as user-facing Chinese status text', () => {
    render(<AgentTimeline run={run({ timeline: [
      { type: 'format_repair' },
      { type: 'tool_input_repair', tool: 'inspect_asset' },
      { type: 'response_fallback' },
    ] })} />)

    expect(screen.getByText('正在适配模型返回格式')).toBeTruthy()
    expect(screen.getByText('正在修正工具参数：检查素材')).toBeTruthy()
    expect(screen.getByText('已转为安全对话答复')).toBeTruthy()
    expect(screen.queryByText('format_repair')).toBeNull()
  })

  it('shows the actual error reason for a failed run', () => {
    render(<AgentTimeline run={run({ status: 'failed', errorMessage: '模型没有返回可读内容，请重试。' })} />)

    expect(screen.getByText('任务未完成')).toBeTruthy()
    expect(screen.getByText('模型没有返回可读内容，请重试。')).toBeTruthy()
  })
})
