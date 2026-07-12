// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FeedbackProvider } from '../components/FeedbackProvider'
import LibraryPage from './LibraryPage'

const api = vi.hoisted(() => ({ list: vi.fn(), upload: vi.fn(), rename: vi.fn(), remove: vi.fn() }))
const authUser = vi.hoisted(() => ({ id: 'owner', username: 'owner' }))
vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    getMyProjects: vi.fn(async () => []),
    getAssetLibrary: (...args: unknown[]) => api.list(...args),
    uploadAsset: (...args: unknown[]) => api.upload(...args),
    renameAsset: (...args: unknown[]) => api.rename(...args),
    deleteAsset: (...args: unknown[]) => api.remove(...args),
  }
})
vi.mock('../stores/authStore', () => ({ useAuthStore: () => ({ user: authUser }) }))
vi.mock('../assets/AssetProcessingSheet', () => ({ default: () => <div>素材处理弹窗</div> }))

describe('global asset library', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('loads and uploads user assets without a project selector', async () => {
    const uploaded = { id: 'asset', name: 'portrait.png', type: 'CG', url: '/uploads/library/owner/portrait.png', createdAt: '2026-07-12' }
    api.list.mockResolvedValue([])
    api.upload.mockResolvedValue(uploaded)
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FeedbackProvider><LibraryPage /></FeedbackProvider></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /全局素材/ }))
    await waitFor(() => expect(api.list).toHaveBeenCalled())
    expect(screen.queryByLabelText('选择项目')).not.toBeInTheDocument()
    expect(screen.getAllByText(/所有故事项目/).length).toBeGreaterThan(0)
    await screen.findByText(/素材库还是空的/)

    const file = new File(['image'], 'portrait.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('上传素材文件'), { target: { files: [file] } })
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith(file, 'CG'))
    expect(await screen.findByText('portrait.png')).toBeInTheDocument()
  })
})
