// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyAgentRun, createAgentRun, getAgentRun, undoAgentRun } from '../api/client'
import { useAgentRun } from './useAgentRun'

vi.mock('../api/client', () => ({
  createAgentRun: vi.fn(), getAgentRun: vi.fn(), cancelAgentRun: vi.fn(), rejectAgentRun: vi.fn(), retryAgentRun: vi.fn(),
  applyAgentRun: vi.fn(), undoAgentRun: vi.fn(),
}))

const baseRun = {
  id: 'run', status: 'queued' as const, prompt: '检查', scope: 'chapter', targetId: null, provider: 'test', model: 'fake',
  plan: [], timeline: [], sources: [], validation: {}, errorCode: null, errorMessage: null, patch: null,
  usage: { mode: 'provider' as const, provider: 'test', model: 'fake', toolCalls: 0, tools: [], memorySuggestions: 0, patch: false, fallback: false },
  createdAt: '', updatedAt: '', completedAt: null,
}

describe('useAgentRun', () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear() })

  it('restores the last proposal after reopening its conversation without persisting credentials', async () => {
    vi.mocked(createAgentRun).mockResolvedValue({ ...baseRun, status: 'awaiting_approval' })
    vi.mocked(getAgentRun).mockResolvedValue({ ...baseRun, status: 'awaiting_approval' })
    const first = renderHook(() => useAgentRun('project:conversation'))
    await act(() => first.result.current.start({ projectId: 'p', conversationId: 'c', chapterId: 'ch', prompt: '检查', scope: 'chapter', providerConfig: { provider: 'test', model: 'fake', apiKey: 'secret-test-key' } }))
    first.unmount()
    const next = renderHook(() => useAgentRun('project:conversation'))
    await waitFor(() => expect(next.result.current.run?.status).toBe('awaiting_approval'))
    expect(getAgentRun).toHaveBeenCalledWith('run')
    expect(Object.values(sessionStorage).join('')).not.toContain('secret-test-key')
    const other = renderHook(() => useAgentRun('project:other-conversation'))
    expect(other.result.current.run).toBeNull()
  })

  it('recovers an accepted task even when the panel closes before the POST finishes', async () => {
    let resolve!: (value: typeof baseRun) => void
    vi.mocked(createAgentRun).mockReturnValue(new Promise(done => { resolve = done }))
    vi.mocked(getAgentRun).mockResolvedValue({ ...baseRun, status: 'awaiting_approval' })
    const first = renderHook(() => useAgentRun('project:slow'))
    let pending!: Promise<void>
    act(() => { pending = first.result.current.start({ projectId: 'p', conversationId: 'slow', chapterId: 'ch', prompt: '检查', scope: 'chapter', providerConfig: { provider: 'test', model: 'fake', apiKey: 'key' } }) })
    first.unmount()
    const next = renderHook(() => useAgentRun('project:slow'))
    expect(next.result.current.isSubmitting).toBe(true)
    await act(async () => { resolve(baseRun); await pending })
    await waitFor(() => expect(next.result.current.run?.id).toBe('run'))
    next.unmount()
    const reopened = renderHook(() => useAgentRun('project:slow'))
    await waitFor(() => expect(reopened.result.current.run?.status).toBe('awaiting_approval'))
    expect(createAgentRun).toHaveBeenCalledOnce()
  })

  it('polls active runs and stops at approval', async () => {
    vi.mocked(createAgentRun).mockResolvedValue(baseRun)
    vi.mocked(getAgentRun).mockResolvedValue({ ...baseRun, status: 'awaiting_approval' })
    const { result } = renderHook(() => useAgentRun())

    await act(() => result.current.start({ projectId: 'p', conversationId: 'c', chapterId: 'ch', prompt: '检查', scope: 'chapter', providerConfig: { provider: 'test', model: 'fake', apiKey: 'key' } }))

    await waitFor(() => expect(result.current.run?.status).toBe('awaiting_approval'), { timeout: 3_000 })
    expect(getAgentRun).toHaveBeenCalledTimes(1)
  })

  it('returns applied and undone graphs', async () => {
    vi.mocked(createAgentRun).mockResolvedValue({ ...baseRun, status: 'awaiting_approval' })
    vi.mocked(applyAgentRun).mockResolvedValue({ chapterId: 'ch', version: 2, graph: { nodes: [], edges: [] } })
    vi.mocked(undoAgentRun).mockResolvedValue({ chapterId: 'ch', version: 3, graph: { nodes: [], edges: [] } })
    const { result } = renderHook(() => useAgentRun())
    await act(() => result.current.start({ projectId: 'p', conversationId: 'c', chapterId: 'ch', prompt: '检查', scope: 'chapter', providerConfig: { provider: 'test', model: 'fake', apiKey: 'key' } }))

    await expect(result.current.apply()).resolves.toMatchObject({ version: 2 })
    await expect(result.current.undo()).resolves.toMatchObject({ version: 3 })
  })
})
