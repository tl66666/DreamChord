// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '../components/FeedbackProvider'
import HomePage from './HomePage'

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
  it('provides a compact mobile menu with the primary destinations', () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FeedbackProvider><HomePage /></FeedbackProvider></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: '打开导航菜单' }))

    expect(screen.getByRole('navigation', { name: '移动端导航' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '素材库' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: '创作 Agent' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '退出登录' })).toBeTruthy()
  })
})
