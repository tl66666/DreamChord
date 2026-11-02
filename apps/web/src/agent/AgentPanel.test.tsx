// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentPanel from './AgentPanel'

const state = vi.hoisted(() => ({ controller: {} as Record<string, unknown>, provider: null as null | { provider: string; model: string; apiKey: string } }))
vi.mock('./useAgentRun', () => ({ useAgentRun: () => state.controller }))
vi.mock('../lib/aiConfig', () => ({
  getDefaultProvider: () => state.provider,
  setActiveModel: vi.fn(),
  PROVIDER_META: [{ provider: 'test', models: ['fake'] }],
}))
const createConversation = vi.hoisted(() => vi.fn(async () => ({ id: 'conversation-new' })))
vi.mock('../api/client', () => ({ createAgentConversation: createConversation }))

const baseRun = {
  id: 'run', chapterId: 'chapter', prompt: '检查', scope: 'chapter', targetId: null, provider: 'test', model: 'fake', plan: ['读取章节', '检查结构'],
  timeline: [], sources: [], validation: {}, errorCode: null, errorMessage: null, patch: null, createdAt: '', updatedAt: '', completedAt: null,
  usage: { mode: 'provider', provider: 'test', model: 'fake', toolCalls: 0, tools: [], memorySuggestions: 0, patch: false, fallback: false },
}

function controller(run: unknown) {
  return { run, isSubmitting: false, error: '', start: vi.fn(), cancel: vi.fn(), reject: vi.fn(), retry: vi.fn(), apply: vi.fn(), undo: vi.fn(), reset: vi.fn() }
}

const props = {
  projectId: 'project', chapterId: 'chapter', chapterVersion: 1, selectedNodeId: null, selectedSceneId: null,
  graph: { nodes: [], edges: [] }, onApplyGraph: vi.fn(), onSelectNode: vi.fn(), onClose: vi.fn(),
}

describe('AgentPanel', () => {
  afterEach(() => { cleanup(); sessionStorage.clear() })
  beforeEach(() => { vi.clearAllMocks(); state.provider = { provider: 'test', model: 'fake', apiKey: 'key' }; state.controller = controller(null) })

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

  it('uses the explicitly chosen scene instead of overriding it with the editor selection', async () => {
    const start = vi.fn(async () => undefined)
    state.controller = { ...controller(null), start }
    render(<AgentPanel {...props} selectedSceneId="scene-a" graph={{ nodes: ['a', 'b'].map((id) => ({ id, type: 'dialogue', position: { x: 0, y: 0 }, data: { sceneGroupId: `scene-${id}`, sceneTitle: `场景${id}`, text: id } })), edges: [] }} />)
    fireEvent.click(screen.getByRole('button', { name: '当前场景' }))
    fireEvent.change(screen.getByLabelText('修改目标'), { target: { value: 'scene-b' } })
    fireEvent.change(screen.getByLabelText('创作任务'), { target: { value: '检查这里' } })
    fireEvent.click(screen.getByRole('button', { name: '发送给 Agent' }))
    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.objectContaining({ targetId: 'scene-b' })))
  })

  it('restores an unsent instruction after leaving for model settings', () => {
    const view = render(<AgentPanel {...props} />)
    fireEvent.change(screen.getByLabelText('创作任务'), { target: { value: '还没发送的创作要求' } })
    view.unmount()
    render(<AgentPanel {...props} />)
    expect(screen.getByLabelText('创作任务')).toHaveProperty('value', '还没发送的创作要求')
  })

  it('keeps the instruction and reports a conversation startup failure', async () => {
    createConversation.mockRejectedValueOnce(new Error('unavailable'))
    render(<AgentPanel {...props} />)
    fireEvent.change(screen.getByLabelText('创作任务'), { target: { value: '检查这里' } })
    fireEvent.click(screen.getByRole('button', { name: '发送给 Agent' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/内容已保留/))
    expect(screen.getByLabelText('创作任务')).toHaveProperty('value', '检查这里')
  })

  it('shows progress and cancel while active', () => {
    state.controller = controller({ ...baseRun, status: 'drafting' })
    render(<AgentPanel {...props} />)
    expect(screen.getByText('正在生成草案')).toBeTruthy()
    expect(screen.getByRole('button', { name: '取消任务' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '应用变更' })).toBeNull()
  })

  it('does not offer undo after a completed read-only conversation', () => {
    state.controller = controller({ ...baseRun, status: 'completed', patch: null })
    render(<AgentPanel {...props} />)

    expect(screen.queryByRole('button', { name: '撤销变更' })).toBeNull()
  })

  it('shows approval commands and patch diff while awaiting approval', () => {
    state.controller = controller({ ...baseRun, status: 'awaiting_approval', patch: { id: 'patch', status: 'proposed', payload: { operations: [] }, validation: { valid: true }, diff: { addedNodeIds: ['new'], updatedNodeIds: [], removedNodeIds: [], addedEdgeIds: [], removedEdgeIds: [] }, baseVersion: 1, appliedVersion: null } })
    render(<AgentPanel {...props} />)
    expect(screen.getByText('新增节点')).toBeTruthy()
    expect(screen.getByRole('button', { name: '应用变更' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '放弃草案' })).toBeTruthy()
  })

  it.each(['awaiting_approval', 'completed'])('does not apply or undo a restored %s proposal belonging to another chapter', (status) => {
    const apply = vi.fn(), undo = vi.fn()
    state.controller = { ...controller({ ...baseRun, chapterId: 'other-chapter', status, patch: { id: 'patch', status: 'proposed', payload: { operations: [] }, validation: { valid: true }, diff: { addedNodeIds: [], updatedNodeIds: [], removedNodeIds: [], addedEdgeIds: [], removedEdgeIds: [] }, baseVersion: 1, appliedVersion: 2 } }), apply, undo }
    render(<AgentPanel {...props} />)
    const button = screen.getByRole('button', { name: status === 'completed' ? '撤销变更' : '应用变更' })
    expect(button).toHaveProperty('disabled', true)
    expect(screen.getByText(/该草案属于其他章节/)).toBeTruthy()
    fireEvent.click(button)
    expect(apply).not.toHaveBeenCalled()
    expect(undo).not.toHaveBeenCalled()
  })

  it('waits for the current proposal to be handled before consuming a new auto-run request', async () => {
    const start = vi.fn(async () => undefined)
    const consume = vi.fn()
    state.controller = { ...controller({ ...baseRun, status: 'awaiting_approval' }), start }
    const request = { id: 902, prompt: '转换新的正文', scope: 'chapter' as const, autoRun: true }
    const view = render(<AgentPanel {...props} taskRequest={request} onTaskConsumed={consume} />)
    expect(start).not.toHaveBeenCalled()
    expect(consume).not.toHaveBeenCalled()
    state.controller = { ...controller({ ...baseRun, status: 'completed' }), start }
    view.rerender(<AgentPanel {...props} taskRequest={request} onTaskConsumed={consume} />)
    await waitFor(() => expect(start).toHaveBeenCalledOnce())
    expect(consume).toHaveBeenCalledWith(902)
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
    expect(screen.getByText('本地创作模式')).toBeTruthy()
  })

  it('toggles the local health report closed when the health command is used again', () => {
    state.controller = controller(null)
    render(<AgentPanel {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '运行剧情体检' }))
    expect(screen.getByRole('button', { name: '收起剧情体检' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '收起剧情体检' }))

    expect(screen.queryByText(/规则体检/)).toBeNull()
  })

  it('runs the selected-scene continuation shortcut instead of only filling the composer', async () => {
    const start = vi.fn(async () => undefined)
    state.controller = { ...controller(null), start }
    render(<AgentPanel {...props} compact selectedSceneId="scene-1" graph={{
      nodes: [{ id: 'line-1', type: 'dialogue', position: { x: 0, y: 0 }, data: { sceneGroupId: 'scene-1', role: '雪', text: '别走。' } }], edges: [],
    }} />)

    fireEvent.click(screen.getByRole('button', { name: '续写已选场景' }))

    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.objectContaining({ scope: 'scene', targetId: 'scene-1' })))
  })

  it('runs a conversation draft task immediately when the workspace requests it', async () => {
    const start = vi.fn(async () => undefined)
    state.controller = { ...controller(null), start }
    render(<AgentPanel {...props} taskRequest={{ id: 1, prompt: '根据当前对话中最近一份续写草稿，创建可编辑的工作台场景。', scope: 'chapter', autoRun: true }} />)

    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.objectContaining({ scope: 'chapter', prompt: expect.stringContaining('最近一份续写草稿') })))
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

  it('keeps the selected material strategy out of the visible user message', async () => {
    const start = vi.fn(async () => undefined)
    state.controller = { ...controller(null), start }
    render(<AgentPanel {...props} />)

    fireEvent.change(screen.getByLabelText('素材策略'), { target: { value: 'prompts' } })
    fireEvent.change(screen.getByLabelText('创作任务'), { target: { value: '为这一段生成可运行场景' } })
    fireEvent.click(screen.getByRole('button', { name: '发送给 Agent' }))

    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.objectContaining({
      prompt: '为这一段生成可运行场景', materialMode: 'prompts',
    })))
  })

  it('fills a project-aware starter without submitting it immediately', () => {
    state.controller = controller(null)
    render(<AgentPanel {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '了解项目' }))

    expect(screen.getByLabelText('创作任务')).toHaveProperty('value', '概括整个项目，并告诉我现在最值得先完善什么。')
    expect(state.controller.start).not.toHaveBeenCalled()
  })

  it('lets the writer select the exact card before proposing a modification', () => {
    state.controller = controller(null)
    render(<AgentPanel {...props} selectedNodeId="dialogue-1" graph={{
      nodes: [
        { id: 'dialogue-1', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: '雪', text: '不要靠近那扇门。', sceneGroupId: 'pier', sceneTitle: '雨夜码头' } },
        { id: 'subtitle-1', type: 'subtitle', position: { x: 0, y: 120 }, data: { text: '雾从港口漫上来。', sceneGroupId: 'pier', sceneTitle: '雨夜码头' } },
      ],
      edges: [],
    }} />)

    fireEvent.click(screen.getByRole('button', { name: '当前镜头' }))
    expect((screen.getByLabelText('修改目标') as HTMLSelectElement).value).toBe('dialogue-1')
    expect(screen.getByText('雪：不要靠近那扇门。')).toBeTruthy()
  })

  it('does not create a second vertical scroll surface in compact transcript mode', () => {
    state.controller = controller(null)
    render(<AgentPanel {...props} compact />)

    const panel = screen.getByLabelText('创作任务').closest('aside')
    expect(panel?.querySelector('.overflow-y-auto')).toBeNull()
  })
})
