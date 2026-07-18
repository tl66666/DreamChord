// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '../components/FeedbackProvider'
import AgentWorkspace from './AgentWorkspace'

const api = vi.hoisted(() => ({
  conversations: [{ id: 'conversation', title: '第一章续写', scope: 'chapter', chapterId: 'chapter', isPinned: false, summary: '', createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z' }],
  getConversations: vi.fn(), getMessages: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}))

vi.mock('../api/client', () => ({
  getAgentConversations: (...args: unknown[]) => api.getConversations(...args),
  getAgentMessages: (...args: unknown[]) => api.getMessages(...args),
  createAgentConversation: (...args: unknown[]) => api.create(...args),
  updateAgentConversation: (...args: unknown[]) => api.update(...args),
  deleteAgentConversation: (...args: unknown[]) => api.remove(...args),
}))
vi.mock('./AgentPanel', () => ({ default: ({ taskRequest }: { taskRequest?: { prompt: string; draft?: string; autoRun?: boolean } }) => <div data-testid="agent-composer">{taskRequest?.autoRun ? `${taskRequest.prompt}\n${taskRequest.draft || ''}` : 'Agent composer'}</div> }))

function renderWorkspace(chapterId: string | null = 'chapter') {
  return render(<FeedbackProvider><AgentWorkspace
    projectId="project" projectTitle="测试故事" chapterId={chapterId} chapterTitle={chapterId ? '第一章' : null} chapterVersion={chapterId ? 1 : null}
    graph={{ nodes: [], edges: [] }} selectedNodeId={null} onConversationChange={vi.fn()} onApplyGraph={vi.fn()} onSelectNode={vi.fn()}
  /></FeedbackProvider>)
}

describe('agent workspace', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

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
  })
})
