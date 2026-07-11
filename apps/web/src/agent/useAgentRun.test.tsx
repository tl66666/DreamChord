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
  createdAt: '', updatedAt: '', completedAt: null,
}

describe('useAgentRun', () => {
  beforeEach(() => { vi.clearAllMocks() })

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
