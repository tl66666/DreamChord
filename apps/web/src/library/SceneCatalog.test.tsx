// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultScenes, loadLibraryScenes, SCENE_KEY } from '../lib/libraryData'
import SceneCatalog from './SceneCatalog'
vi.mock('../api/client', async (original) => ({ ...await original<typeof import('../api/client')>(), getMyProjects: vi.fn(async () => [{ id: 'story', title: '我的故事', characters: [] }]) }))
describe('background discovery and handoff', () => {
  afterEach(() => { cleanup(); localStorage.clear() })
  const props = { scenes: defaultScenes, onCreate: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onReset: vi.fn(), onUse: vi.fn() }
  it('filters by place and mood, and previews the full composition', () => {
    render(<SceneCatalog {...props} />)
    fireEvent.change(screen.getByLabelText('背景场所'), { target: { value: '室内' } })
    expect(screen.getByText('雨夜咖啡馆')).toBeInTheDocument()
    expect(screen.queryByText('黄昏教室')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('预览雨夜咖啡馆'))
    expect(screen.getByRole('dialog', { name: '雨夜咖啡馆' })).toBeInTheDocument()
    expect(screen.getByAltText('雨夜咖啡馆完整背景')).toHaveAttribute('src', '/assets/backgrounds/bg-cafe.png')
  })
  it('carries a chosen background and target story without applying it to an arbitrary scene', async () => {
    const use = vi.fn()
    render(<SceneCatalog {...props} onUse={use} />)
    fireEvent.click(within(screen.getByText('黄昏教室').closest('article')!).getByText('用于故事'))
    const dialog = await screen.findByRole('dialog', { name: '把背景带入故事' })
    await within(dialog).findByRole('option', { name: '我的故事' })
    expect(use).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByText('进入编辑器选场景'))
    expect(use).toHaveBeenCalledWith(defaultScenes[0], 'story')
  })
  it('preserves an intentional empty library and custom scene names across reloads', () => {
    localStorage.setItem(SCENE_KEY, '[]')
    expect(loadLibraryScenes()).toEqual([])
    localStorage.setItem(SCENE_KEY, JSON.stringify([{ ...defaultScenes[2], name: '我自己的咖啡馆' }]))
    expect(loadLibraryScenes()[0].name).toBe('我自己的咖啡馆')
  })
})
