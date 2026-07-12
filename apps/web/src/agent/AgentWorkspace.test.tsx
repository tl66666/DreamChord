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
vi.mock('./AgentPanel', () => ({ default: () => <div>Agent composer</div> }))

function renderWorkspace() {
  return render(<FeedbackProvider><AgentWorkspace
    projectId="project" projectTitle="测试故事" chapterId="chapter" chapterTitle="第一章" chapterVersion={1}
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
})
