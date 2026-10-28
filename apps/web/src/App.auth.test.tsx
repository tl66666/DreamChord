// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthInitializer } from './App'
import { useAuthStore } from './stores/authStore'

const getMe = vi.hoisted(() => vi.fn())
vi.mock('./api/client', () => ({ getMe }))

describe('session initialization', () => {
  beforeEach(() => { useAuthStore.setState({ token: 'test-session', user: null, isLoading: true }); getMe.mockReset() })
  afterEach(() => { cleanup(); useAuthStore.getState().logout(); localStorage.clear() })
  it('keeps the login session when the local backend is temporarily unavailable', async () => {
    getMe.mockRejectedValue({ response: { status: 503 } })
    render(<AuthInitializer />)
    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false))
    expect(useAuthStore.getState().token).toBe('test-session')
  })
  it('clears a session that the server actually rejects', async () => {
    getMe.mockRejectedValue({ response: { status: 401 } })
    render(<AuthInitializer />)
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull())
  })
})
