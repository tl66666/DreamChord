// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentPanel from './AgentPanel'

const state = vi.hoisted(() => ({ controller: {} as Record<string, unknown>, provider: null as null | { provider: string; model: string; apiKey: string } }))
vi.mock('./useAgentRun', () => ({ useAgentRun: () => state.controller }))
vi.mock('../lib/aiConfig', () => ({ getDefaultProvider: () => state.provider }))
const createConversation = vi.hoisted(() => vi.fn(async () => ({ id: 'conversation-new' })))
vi.mock('../api/client', () => ({ createAgentConversation: createConversation }))

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
    expect(screen.getByRole('button', { name: '发送给 Agent' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '了解项目' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '检查剧情' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '梳理角色' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '素材建议' })).toBeTruthy()
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

  it('does not apply a proposal while the editor has unsaved work', () => {
    const apply = vi.fn()
    state.controller = { ...controller({ ...baseRun, status: 'awaiting_approval', patch: { id: 'patch', status: 'proposed', payload: { operations: [] }, validation: { valid: true }, diff: { addedNodeIds: [], updatedNodeIds: [], removedNodeIds: [], addedEdgeIds: [], removedEdgeIds: [] }, baseVersion: 1, appliedVersion: null } }), apply }

    render(<AgentPanel {...props} getGraphMutationBlockedReason={() => '请先保存当前编辑，再重新生成 Agent 草稿。'} />)

    const applyButton = screen.getByRole('button', { name: '应用变更' })
    expect(applyButton).toHaveProperty('disabled', true)
    expect(screen.getByText('请先保存当前编辑，再重新生成 Agent 草稿。')).toBeTruthy()
    fireEvent.click(applyButton)
    expect(apply).not.toHaveBeenCalled()
    expect(props.onApplyGraph).not.toHaveBeenCalled()
  })

  it('does not apply a proposal generated for an older chapter version', () => {
    const apply = vi.fn()
    state.controller = { ...controller({ ...baseRun, status: 'awaiting_approval', patch: { id: 'patch', status: 'proposed', payload: { operations: [] }, validation: { valid: true }, diff: { addedNodeIds: [], updatedNodeIds: [], removedNodeIds: [], addedEdgeIds: [], removedEdgeIds: [] }, baseVersion: 1, appliedVersion: null } }), apply }

    render(<AgentPanel {...props} chapterVersion={2} />)

    const applyButton = screen.getByRole('button', { name: '应用变更' })
    expect(applyButton).toHaveProperty('disabled', true)
    expect(screen.getByText('章节已在草稿生成后发生变化，请重新生成 Agent 草稿。')).toBeTruthy()
    fireEvent.click(applyButton)
    expect(apply).not.toHaveBeenCalled()
  })

  it('rechecks editor state immediately before invoking the apply API', () => {
    let blocked = false
    const apply = vi.fn()
    state.controller = { ...controller({ ...baseRun, status: 'awaiting_approval', patch: { id: 'patch', status: 'proposed', payload: { operations: [] }, validation: { valid: true }, diff: { addedNodeIds: [], updatedNodeIds: [], removedNodeIds: [], addedEdgeIds: [], removedEdgeIds: [] }, baseVersion: 1, appliedVersion: null } }), apply }

    render(<AgentPanel {...props} getGraphMutationBlockedReason={() => blocked ? '编辑器刚刚产生了未保存修改。' : undefined} />)
    const applyButton = screen.getByRole('button', { name: '应用变更' })
    expect(applyButton).toHaveProperty('disabled', false)

    blocked = true
    fireEvent.click(applyButton)

    expect(apply).not.toHaveBeenCalled()
    expect(props.onApplyGraph).not.toHaveBeenCalled()
  })

  it('keeps deterministic health check available without a provider', () => {
    state.provider = null
    state.controller = controller(null)
    render(<AgentPanel {...props} />)
    expect(screen.getByRole('button', { name: '运行剧情体检' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '发送给 Agent' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '前往模型设置' })).toBeTruthy()
  })

  it('reuses and reports the full-screen conversation id', async () => {
    const onConversationChange = vi.fn()
    state.controller = controller(null)
    render(<AgentPanel {...props} initialConversationId="conversation-existing" onConversationChange={onConversationChange} />)
    fireEvent.change(screen.getByLabelText('创作任务'), { target: { value: '检查第二章分支' } })
    fireEvent.click(screen.getByRole('button', { name: '发送给 Agent' }))

    await waitFor(() => expect(state.controller.start).toHaveBeenCalled())
    expect(state.controller.start).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conversation-existing' }))
    expect(createConversation).not.toHaveBeenCalled()
    expect(onConversationChange).toHaveBeenCalledWith('conversation-existing')
  })

  it('fills a project-aware starter without submitting it immediately', () => {
    state.controller = controller(null)
    render(<AgentPanel {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '了解项目' }))

    expect(screen.getByLabelText('创作任务')).toHaveProperty('value', '概括整个项目，并告诉我现在最值得先完善什么。')
    expect(state.controller.start).not.toHaveBeenCalled()
  })
})
