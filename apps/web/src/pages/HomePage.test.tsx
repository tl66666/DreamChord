// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '../components/FeedbackProvider'
import { getMyProjects } from '../api/client'
import HomePage, { MAX_PROJECT_BACKUP_BYTES } from './HomePage'

const authState = vi.hoisted(() => ({ user: { username: 'demo', nickname: '梦弦官方' }, isLoading: false, logout: vi.fn() }))

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => authState,
}))

vi.mock('../api/client', () => ({
  getMyProjects: vi.fn(async () => []),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  exportProjectBackup: vi.fn(),
  importProjectBackup: vi.fn(),
  updateProject: vi.fn(),
}))

describe('HomePage navigation', () => {
  afterEach(() => {
    cleanup()
    vi.mocked(getMyProjects).mockResolvedValue([])
  })

  it('allows the portable v2 backup envelope produced by a 64 MiB asset bundle', () => {
    expect(MAX_PROJECT_BACKUP_BYTES).toBeGreaterThanOrEqual(90 * 1024 * 1024)
  })

  it('provides a compact mobile menu with the primary destinations', () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FeedbackProvider><HomePage /></FeedbackProvider></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: '打开导航菜单' }))

    expect(screen.getByRole('navigation', { name: '移动端导航' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '素材库' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: '创作 Agent' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '退出登录' })).toBeTruthy()
  })

  it('opens the creative agent in the selected project context', async () => {
    vi.mocked(getMyProjects).mockResolvedValueOnce([{
      id: 'story-one', title: '雾港来信', description: '', cover: '', isPublic: false, isPublished: false,
      author: { username: 'demo', nickname: '梦弦官方' }, characters: [], chapters: [],
    }])
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FeedbackProvider><HomePage /></FeedbackProvider></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('雾港来信')).toBeTruthy())
    expect(screen.getByRole('link', { name: '问 Agent' }).getAttribute('href')).toBe('/agent?project=story-one')
  })
})
