// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '../components/FeedbackProvider'
import MemoryCenter from './MemoryCenter'

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), forget: vi.fn() }))
vi.mock('../api/client', () => ({
  getAgentMemories: (...args: unknown[]) => api.list(...args),
  createAgentMemory: (...args: unknown[]) => api.create(...args),
  updateAgentMemory: (...args: unknown[]) => api.update(...args),
  forgetAgentMemory: (...args: unknown[]) => api.forget(...args),
}))

const memory = { id: 'memory', projectId: 'project', conversationId: null, kind: 'character', title: '雪的恐惧', content: '害怕被遗忘', tags: ['女主角'], importance: 90, status: 'suggested', isPinned: false, sourceType: 'assistant', sourceId: null, supersededById: null, createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z' }

describe('memory center', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('shows memory provenance and lets users confirm, pin, and forget it', async () => {
    api.list.mockResolvedValue([memory])
    api.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({ ...memory, ...patch }))
    api.forget.mockResolvedValue(undefined)
    render(<FeedbackProvider><MemoryCenter projectId="project" conversationId="conversation" /></FeedbackProvider>)

    expect(await screen.findByText('雪的恐惧')).toBeTruthy()
    expect(screen.getByText('Agent 建议')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认记忆' }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('memory', { status: 'active' }))
    fireEvent.click(screen.getByRole('button', { name: '固定记忆' }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('memory', { isPinned: true }))
    fireEvent.click(screen.getByRole('button', { name: '遗忘记忆' }))
    fireEvent.click(await screen.findByRole('button', { name: '遗忘' }))
    await waitFor(() => expect(api.forget).toHaveBeenCalledWith('memory'))
  })

  it('creates a project memory with explicit kind and importance', async () => {
    api.list.mockResolvedValue([])
    api.create.mockResolvedValue({ ...memory, id: 'new', status: 'active' })
    render(<FeedbackProvider><MemoryCenter projectId="project" conversationId="conversation" /></FeedbackProvider>)
    fireEvent.click(await screen.findByRole('button', { name: '添加记忆' }))
    fireEvent.change(screen.getByLabelText('记忆标题'), { target: { value: '世界规则' } })
    fireEvent.change(screen.getByLabelText('记忆内容'), { target: { value: '夜晚不能说出真名' } })
    fireEvent.click(screen.getByRole('button', { name: '保存记忆' }))
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('project', expect.objectContaining({ title: '世界规则', content: '夜晚不能说出真名', status: 'active' })))
  })
})
