// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AIWriterPage from './AIWriterPage'

vi.mock('../api/client', () => ({
  getMyProjects: vi.fn(async () => [{ id: 'project', title: '测试故事', description: '', cover: '', isPublic: false, isPublished: false, author: { username: 'owner', nickname: null }, characters: [], chapters: [{ id: 'chapter', title: '第一章', order: 0, version: 1, nodes: [], edges: [] }] }]),
}))
vi.mock('../agent/AgentPanel', () => ({
  default: ({ projectId, chapterId }: { projectId: string; chapterId: string }) => (
    <div>Agent 工作区 {projectId}/{chapterId}</div>
  ),
}))

function LocationProbe() {
  return <output aria-label="当前地址">{useLocation().search}</output>
}

describe('full-screen creative agent', () => {
  afterEach(cleanup)
  it('shows project and chapter selection before the agent workspace', async () => {
    render(<MemoryRouter initialEntries={['/agent']}><AIWriterPage /><LocationProbe /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '创作 Agent' })).toBeTruthy()
    await waitFor(() => expect(screen.getByLabelText('选择项目')).toBeTruthy())
    expect(screen.getByLabelText('选择章节')).toBeTruthy()
    expect(screen.getByText('Agent 工作区 project/chapter')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByLabelText('当前地址').textContent).toContain('project=project')
      expect(screen.getByLabelText('当前地址').textContent).toContain('chapter=chapter')
    })
    expect(screen.queryByText('本地 AI 草稿')).toBeNull()
  })
})
