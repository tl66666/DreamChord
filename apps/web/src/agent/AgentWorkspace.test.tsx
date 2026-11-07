// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '../components/FeedbackProvider'
import AgentWorkspace from './AgentWorkspace'

const api = vi.hoisted(() => ({
  conversations: [{ id: 'conversation', title: '第一章续写', scope: 'chapter', chapterId: 'chapter', isPinned: false, summary: '', createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z' }],
  getConversations: vi.fn(), getMessages: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), updateMessage: vi.fn(),
}))

vi.mock('../api/client', () => ({
  getAgentConversations: (...args: unknown[]) => api.getConversations(...args),
  getAgentMessages: (...args: unknown[]) => api.getMessages(...args),
  createAgentConversation: (...args: unknown[]) => api.create(...args),
  updateAgentConversation: (...args: unknown[]) => api.update(...args),
  deleteAgentConversation: (...args: unknown[]) => api.remove(...args),
  updateAgentMessage: (...args: unknown[]) => api.updateMessage(...args),
}))
vi.mock('./AgentPanel', () => ({ default: ({ taskRequest, onTaskConsumed }: { taskRequest?: { id: number; prompt: string; draft?: string; autoRun?: boolean }; onTaskConsumed?: (id: number) => void }) => <div data-testid="agent-composer">{taskRequest?.autoRun ? <><span>{`${taskRequest.prompt}\n${taskRequest.draft || ''}`}</span><button onClick={() => onTaskConsumed?.(taskRequest.id)}>标记任务已处理</button></> : 'Agent composer'}</div> }))

function renderWorkspace(chapterId: string | null = 'chapter') {
  return render(<FeedbackProvider><AgentWorkspace
    projectId="project" projectTitle="测试故事" chapterId={chapterId} chapterTitle={chapterId ? '第一章' : null} chapterVersion={chapterId ? 1 : null}
    graph={{ nodes: [], edges: [] }} selectedNodeId={null} onConversationChange={vi.fn()} onApplyGraph={vi.fn()} onSelectNode={vi.fn()}
  /></FeedbackProvider>)
}

describe('agent workspace', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })

  it('ignores a previous conversation response after switching chats', async () => {
    let resolveOld!: (value: unknown) => void
    const oldRequest = new Promise((resolve) => { resolveOld = resolve })
    api.getConversations.mockResolvedValue([...api.conversations, { ...api.conversations[0], id: 'other', title: '另一条对话' }])
    api.getMessages.mockImplementation((id: string) => id === 'conversation' ? oldRequest : Promise.resolve({ items: [{ id: 'other-message', role: 'assistant', content: '另一条对话正文', metadata: {}, createdAt: '' }], nextCursor: null }))
    renderWorkspace()
    fireEvent.click(await screen.findByRole('button', { name: /另一条对话/ }))
    expect(await screen.findByText('另一条对话正文')).toBeTruthy()

    await act(async () => resolveOld({ items: [{ id: 'old-message', role: 'assistant', content: '旧对话的延迟正文', metadata: {}, createdAt: '' }], nextCursor: null }))

    expect(screen.queryByText('旧对话的延迟正文')).toBeNull()
    expect(screen.getByText('另一条对话正文')).toBeTruthy()
  })

  it('preserves loaded history and its cursor while refreshing recent messages', async () => {
    vi.useFakeTimers()
    api.getConversations.mockResolvedValue(api.conversations)
    const message = (id: string) => ({ id, role: 'assistant', content: id, metadata: {}, createdAt: '' })
    api.getMessages.mockImplementation(async (_id: string, cursor?: string) => cursor
      ? { items: [message('较早正文')], nextCursor: 'oldest-cursor' }
      : { items: [message('最新正文')], nextCursor: 'recent-cursor' })
    await act(async () => { renderWorkspace() })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '加载更早消息' })))
    expect(screen.getByText('较早正文')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByText('较早正文')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '加载更早消息' })))
    expect(api.getMessages).toHaveBeenLastCalledWith('conversation', 'oldest-cursor')
  })

  it('shows replies when each response takes four seconds and polling runs every three seconds', async () => {
    vi.useFakeTimers()
    api.getConversations.mockResolvedValue(api.conversations)
    let responseNumber = 0
    api.getMessages.mockImplementation(() => {
      const content = `慢速正文${++responseNumber}`
      return new Promise((resolve) => window.setTimeout(() => resolve({ items: [{ id: 'message', role: 'assistant', content, metadata: {}, createdAt: '' }], nextCursor: null }), 4000))
    })
    await act(async () => { renderWorkspace() })
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(screen.queryByText('慢速正文1')).not.toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(screen.queryByText('慢速正文2')).not.toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(screen.queryByText('慢速正文3')).not.toBeNull()
  })

  it('waits for the current poll before requesting a newer reply in the same conversation', async () => {
    vi.useFakeTimers()
    let resolveOld!: (value: unknown) => void
    const oldRequest = new Promise((resolve) => { resolveOld = resolve })
    const page = (content: string) => ({ items: [{ id: 'message', role: 'assistant', content, metadata: {}, createdAt: '' }], nextCursor: null })
    api.getConversations.mockResolvedValue(api.conversations)
    api.getMessages.mockResolvedValueOnce(page('原文')).mockReturnValueOnce(oldRequest).mockResolvedValue(page('新版正文'))
    await act(async () => { renderWorkspace() })
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(api.getMessages).toHaveBeenCalledTimes(2)
    expect(screen.getByText('原文')).toBeTruthy()
    await act(async () => resolveOld(page('旧版正文')))
    expect(screen.getByText('旧版正文')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(api.getMessages).toHaveBeenCalledTimes(3)
    expect(screen.getByText('新版正文')).toBeTruthy()
  })

  it('does not let an in-flight poll overwrite a successfully saved draft', async () => {
    vi.useFakeTimers()
    let resolvePoll!: (value: unknown) => void
    const poll = new Promise((resolve) => { resolvePoll = resolve })
    const draft = { id: 'draft', role: 'assistant', content: '林宇：旧正文', metadata: {}, createdAt: '' }
    api.getConversations.mockResolvedValue(api.conversations)
    api.getMessages.mockResolvedValueOnce({ items: [draft], nextCursor: null }).mockReturnValueOnce(poll)
    api.updateMessage.mockResolvedValueOnce({ ...draft, content: '林宇：已保存的新正文' })
    await act(async () => { renderWorkspace() })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    fireEvent.click(screen.getByRole('button', { name: '编辑草稿' }))
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: '林宇：已保存的新正文' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '保存草稿' })))
    await act(async () => resolvePoll({ items: [draft], nextCursor: null }))
    expect(screen.getByText('林宇：已保存的新正文')).toBeTruthy()
    expect(screen.queryByText('林宇：旧正文')).toBeNull()
  })

  it('keeps failed draft edits visible and allows retrying the same text', async () => {
    api.getConversations.mockResolvedValue(api.conversations)
    api.getMessages.mockResolvedValue({ items: [{ id: 'draft', role: 'assistant', content: '林宇：原始正文', metadata: {}, createdAt: '' }], nextCursor: null })
    api.updateMessage.mockRejectedValueOnce(new Error('离线')).mockResolvedValueOnce({ id: 'draft', role: 'assistant', content: '林宇：需要保留的新正文', metadata: {}, createdAt: '' })
    renderWorkspace()
    fireEvent.click(await screen.findByRole('button', { name: '编辑草稿' }))
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: '林宇：需要保留的新正文' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    await screen.findByText('草稿保存失败')
    expect((screen.getByLabelText('草稿正文') as HTMLTextAreaElement).value).toBe('林宇：需要保留的新正文')
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    await waitFor(() => expect(api.updateMessage).toHaveBeenCalledTimes(2))
    expect(api.updateMessage).toHaveBeenLastCalledWith('conversation', 'draft', '林宇：需要保留的新正文')
    await waitFor(() => expect(screen.queryByLabelText('草稿正文')).toBeNull())
  })

  it('renames and pins a persisted conversation', async () => {
    api.getConversations.mockResolvedValue(api.conversations)
    api.getMessages.mockResolvedValue({ items: [], nextCursor: null })
    api.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({ ...api.conversations[0], ...patch }))
    renderWorkspace()

    await waitFor(() => expect(screen.getAllByText('第一章续写').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: '重命名对话' }))
    fireEvent.change(screen.getByLabelText('重命名对话'), { target: { value: '第二章冲突' } })
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('conversation', { title: '第二章冲突' }))

    fireEvent.click(screen.getByRole('button', { name: '置顶对话' }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('conversation', { isPinned: true }))
  })

  it('creates and deletes conversations through explicit commands', async () => {
    api.getConversations.mockResolvedValue(api.conversations)
    api.getMessages.mockResolvedValue({ items: [], nextCursor: null })
    api.create.mockResolvedValue({ ...api.conversations[0], id: 'new-conversation', title: '新对话' })
    api.remove.mockResolvedValue(undefined)
    renderWorkspace()

    await waitFor(() => expect(screen.getAllByText('第一章续写').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: '新建对话' }))
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('project', { title: '新对话', scope: 'chapter', chapterId: 'chapter' }))

    fireEvent.click(screen.getByRole('button', { name: '删除对话' }))
    fireEvent.click(await screen.findByRole('button', { name: '删除' }))
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('conversation'))
  })

  it('creates a project-scoped conversation without chapter context', async () => {
    api.getConversations.mockResolvedValue([])
    api.getMessages.mockResolvedValue({ items: [], nextCursor: null })
    api.create.mockResolvedValue({ ...api.conversations[0], id: 'project-conversation', title: '新对话', scope: 'project', chapterId: null })
    renderWorkspace(null)

    const createButtons = await screen.findAllByRole('button', { name: '新建对话' })
    fireEvent.click(createButtons[0])
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('project', { title: '新对话', scope: 'project' }))
  })

  it('shows the editor chapter binding and exposes a close command when embedded in the editor', async () => {
    api.getConversations.mockResolvedValue(api.conversations)
    api.getMessages.mockResolvedValue({ items: [], nextCursor: null })
    const onClose = vi.fn()

    render(<FeedbackProvider><AgentWorkspace
      projectId="project" projectTitle="测试故事" chapterId="chapter" chapterTitle="第一章" chapterVersion={1}
      graph={{ nodes: [], edges: [] }} selectedNodeId={null} onConversationChange={vi.fn()} onApplyGraph={vi.fn()} onSelectNode={vi.fn()}
      embeddedInEditor onClose={onClose}
    /></FeedbackProvider>)

    expect(await screen.findByText((_, element) => element?.textContent === '编辑器模式 · 已绑定：第一章')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭 Agent' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('forwards a saved prose draft into an auto-running chapter task', async () => {
    api.getConversations.mockResolvedValue(api.conversations)
    api.getMessages.mockResolvedValue({ items: [{ id: 'draft', role: 'assistant', content: '林宇：\n“我一直在等你回来。”\n\n林晚握紧画册，没有立刻回答。', metadata: {}, createdAt: '2026-07-18T00:00:00.000Z' }], nextCursor: null })
    renderWorkspace()

    fireEvent.click(await screen.findByRole('button', { name: '生成工作台场景' }))

    await waitFor(() => expect(screen.getByTestId('agent-composer').textContent).toContain('林宇：'))
    fireEvent.click(screen.getByRole('button', { name: '标记任务已处理' }))
    expect(screen.getByTestId('agent-composer').textContent).toBe('Agent composer')
  })

  it('keeps a waiting draft attached to the conversation where it was requested', async () => {
    api.getConversations.mockResolvedValue([...api.conversations, { ...api.conversations[0], id: 'other', title: '另一条对话' }])
    api.getMessages.mockResolvedValue({ items: [{ id: 'draft', role: 'assistant', content: '林宇：\n“雨停了，出发吧。”', metadata: {}, createdAt: '' }], nextCursor: null })
    renderWorkspace()
    fireEvent.click(await screen.findByRole('button', { name: '生成工作台场景' }))
    expect(screen.getByTestId('agent-composer').textContent).toContain('林宇：')
    fireEvent.click(screen.getByRole('button', { name: /另一条对话/ }))
    expect(screen.getByTestId('agent-composer').textContent).toBe('Agent composer')
    fireEvent.click(screen.getByRole('button', { name: /第一章续写/ }))
    expect(screen.getByTestId('agent-composer').textContent).toContain('林宇：')
  })
})
