// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

    fireEvent.click(screen.getByRole('button', { name: /我的文件/ }))
    await waitFor(() => expect(api.list).toHaveBeenCalled())
    expect(screen.queryByLabelText('选择项目')).not.toBeInTheDocument()
    expect(screen.getAllByText(/所有故事项目/).length).toBeGreaterThan(0)
    await screen.findByText(/素材库还是空的/)

    const file = new File(['image'], 'portrait.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('上传素材文件'), { target: { files: [file] } })
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith(file, 'CG'))
    expect(await screen.findByText('portrait.png')).toBeInTheDocument()
  })

  it('lets authors inspect a character as full body, bust, and final stage', async () => {
    api.list.mockResolvedValue([])
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FeedbackProvider><LibraryPage /></FeedbackProvider></MemoryRouter>)

    const modeGroup = await screen.findByRole('group', { name: '雪立绘预览模式' })
    const preview = screen.getByTestId('character-preview-yuki')
    expect(preview).toHaveAttribute('data-preview-mode', 'full')

    fireEvent.click(within(modeGroup).getByRole('button', { name: '半身' }))
    expect(preview).toHaveAttribute('data-preview-mode', 'bust')
    expect(within(preview).getByTestId('stage-character-yuki')).toHaveAttribute('data-framing', 'bust')

    fireEvent.click(within(modeGroup).getByRole('button', { name: '舞台' }))
    expect(preview).toHaveAttribute('data-preview-mode', 'stage')
    expect(within(preview).getByText('台词安全区')).toBeInTheDocument()
  })

  it('uses a wide responsive shell with horizontally scrollable navigation', async () => {
    api.list.mockResolvedValue([])
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FeedbackProvider><LibraryPage /></FeedbackProvider></MemoryRouter>)

    expect(await screen.findByTestId('library-shell')).toHaveClass('max-w-[1760px]', 'lg:grid-cols-[232px_minmax(0,1fr)]')
    expect(screen.getByTestId('library-navigation')).toHaveClass('overflow-x-auto', 'lg:sticky')
    expect(screen.getByTestId('library-content')).not.toHaveClass('max-w-7xl')
  })

  it('promotes music into its own first-class library', async () => {
    api.list.mockResolvedValue([])
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FeedbackProvider><LibraryPage /></FeedbackProvider></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: /音乐与音效/ }))
    expect(screen.getByRole('heading', { name: '音乐与音效' })).toBeInTheDocument()
    expect(screen.getByText(/按情绪和剧情用途/)).toBeInTheDocument()
  })
})
