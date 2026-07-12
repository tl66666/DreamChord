// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AIWriterPage from './AIWriterPage'
import { FeedbackProvider } from '../components/FeedbackProvider'

vi.mock('../api/client', () => ({
  getMyProjects: vi.fn(async () => [{ id: 'project', title: '测试故事', description: '', cover: '', isPublic: false, isPublished: false, chapters: [{ id: 'chapter' }] }]),
  getProject: vi.fn(async () => ({ id: 'project', title: '测试故事', description: '', cover: '', isPublic: false, isPublished: false, author: { username: 'owner', nickname: null }, characters: [], chapters: [{ id: 'chapter', title: '第一章', order: 0, version: 1, nodes: [], edges: [] }] })),
  getAgentConversations: vi.fn(async () => [{ id: 'conversation', title: '第一章续写', scope: 'chapter', chapterId: 'chapter', isPinned: false, summary: '', createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z' }]),
  getAgentMessages: vi.fn(async () => ({ items: [], nextCursor: null })),
}))
vi.mock('../agent/AgentPanel', () => ({
  default: ({ projectId, chapterId }: { projectId: string; chapterId: string | null }) => (
    <div>Agent 工作区 {projectId}/{chapterId ?? 'project'}</div>
  ),
}))

function LocationProbe() {
  return <output aria-label="当前地址">{useLocation().search}</output>
}

describe('full-screen creative agent', () => {
  afterEach(cleanup)
  it('starts with project chat and lets the user bind or unbind a chapter', async () => {
    render(<MemoryRouter initialEntries={['/agent']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FeedbackProvider><AIWriterPage /><LocationProbe /></FeedbackProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '创作 Agent' })).toBeTruthy()
    await waitFor(() => expect(screen.getByLabelText('选择项目')).toBeTruthy())
    const chapterSelect = screen.getByLabelText('选择章节') as HTMLSelectElement
    await waitFor(() => expect(screen.getByText('Agent 工作区 project/project')).toBeTruthy())
    expect(chapterSelect.value).toBe('')
    expect(screen.getByRole('option', { name: '不绑定章节（项目对话）' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '新建对话' })).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByLabelText('当前地址').textContent).toContain('project=project')
      expect(screen.getByLabelText('当前地址').textContent).not.toContain('chapter=')
    })
    fireEvent.change(chapterSelect, { target: { value: 'chapter' } })
    await waitFor(() => expect(screen.getByText('Agent 工作区 project/chapter')).toBeTruthy())
    expect(screen.getByLabelText('当前地址').textContent).toContain('chapter=chapter')

    fireEvent.change(chapterSelect, { target: { value: '' } })
    await waitFor(() => expect(screen.getByText('Agent 工作区 project/project')).toBeTruthy())
    expect(screen.getByLabelText('当前地址').textContent).not.toContain('chapter=')
    expect(screen.queryByText('本地 AI 草稿')).toBeNull()
  })
})
