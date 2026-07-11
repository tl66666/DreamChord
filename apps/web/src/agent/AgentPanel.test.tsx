// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentPanel from './AgentPanel'

const state = vi.hoisted(() => ({ controller: {} as Record<string, unknown>, provider: null as null | { provider: string; model: string; apiKey: string } }))
vi.mock('./useAgentRun', () => ({ useAgentRun: () => state.controller }))
vi.mock('../lib/aiConfig', () => ({ getDefaultProvider: () => state.provider }))

const baseRun = {
  id: 'run', prompt: '检查', scope: 'chapter', targetId: null, provider: 'test', model: 'fake', plan: ['读取章节', '检查结构'],
  timeline: [], sources: [], validation: {}, errorCode: null, errorMessage: null, patch: null, createdAt: '', updatedAt: '', completedAt: null,
}

function controller(run: unknown) {
  return { run, isSubmitting: false, error: '', start: vi.fn(), cancel: vi.fn(), reject: vi.fn(), retry: vi.fn(), apply: vi.fn(), undo: vi.fn(), reset: vi.fn() }
}

const props = {
  projectId: 'project', chapterId: 'chapter', chapterVersion: 1, selectedNodeId: null, selectedSceneId: null,
  graph: { nodes: [], edges: [] }, onApplyGraph: vi.fn(), onSelectNode: vi.fn(), onClose: vi.fn(),
}

describe('AgentPanel', () => {
  afterEach(cleanup)
  beforeEach(() => { state.provider = { provider: 'test', model: 'fake', apiKey: 'key' }; state.controller = controller(null) })

  it('shows prompt, scope, shortcuts, and run command while idle', () => {
    render(<AgentPanel {...props} />)
    expect(screen.getByLabelText('创作任务')).toBeTruthy()
    expect(screen.getByText('当前章节')).toBeTruthy()
    expect(screen.getByRole('button', { name: '运行 Agent' })).toBeTruthy()
  })

  it('shows progress and cancel while active', () => {
    state.controller = controller({ ...baseRun, status: 'drafting' })
    render(<AgentPanel {...props} />)
    expect(screen.getByText('正在生成草案')).toBeTruthy()
    expect(screen.getByRole('button', { name: '取消任务' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '应用变更' })).toBeNull()
  })

  it('shows approval commands and patch diff while awaiting approval', () => {
    state.controller = controller({ ...baseRun, status: 'awaiting_approval', patch: { id: 'patch', status: 'proposed', payload: { operations: [] }, validation: { valid: true }, diff: { addedNodeIds: ['new'], updatedNodeIds: [], removedNodeIds: [], addedEdgeIds: [], removedEdgeIds: [] }, baseVersion: 1, appliedVersion: null } })
    render(<AgentPanel {...props} />)
    expect(screen.getByText('新增节点')).toBeTruthy()
    expect(screen.getByRole('button', { name: '应用变更' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '放弃草案' })).toBeTruthy()
  })

  it('keeps deterministic health check available without a provider', () => {
    state.provider = null
    state.controller = controller(null)
    render(<AgentPanel {...props} />)
    expect(screen.getByRole('button', { name: '运行剧情体检' })).toBeTruthy()
    expect(screen.getByText('配置模型后可使用创作任务')).toBeTruthy()
  })
})
