// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { FeedbackProvider } from '../components/FeedbackProvider'
import * as assetPanel from './AssetPanel'

describe('asset panel selection mode', () => {
  it('shows every accepted scene image type while excluding unrelated assets', () => {
    const filterAssetsForSelection = (assetPanel as Record<string, unknown>).filterAssetsForSelection
    expect(typeof filterAssetsForSelection).toBe('function')

    const assets = [
      { id: 'background', type: 'BACKGROUND' },
      { id: 'cg', type: 'CG' },
      { id: 'music', type: 'BGM' },
    ]
    const visible = (filterAssetsForSelection as (items: typeof assets, activeType: string, selectionTypes?: string[]) => typeof assets)(
      assets,
      'BACKGROUND',
      ['BACKGROUND', 'CG'],
    )

    expect(visible.map((asset) => asset.id)).toEqual(['background', 'cg'])
  })

  it('keeps the upload command on one line in the narrow editor sidebar', () => {
    const AssetPanel = assetPanel.default
    render(createElement(FeedbackProvider, null, createElement(AssetPanel, { onClose: () => undefined })))

    const upload = screen.getByRole('button', { name: '上传' })
    expect(upload.className).toContain('shrink-0')
    expect(upload.className).toContain('whitespace-nowrap')
  })

  it('finds built-in backgrounds by story and chapter, and explains empty results', () => {
    cleanup()
    localStorage.clear()
    const onSelect = vi.fn()
    render(createElement(FeedbackProvider, null, createElement(assetPanel.default, { onClose: () => undefined, onSelect })))
    const search = screen.getByPlaceholderText('搜索名称、作品或章节')
    fireEvent.change(search, { target: { value: '第五章' } })
    expect(screen.getByText('街口 · 收信的午后')).toBeTruthy()
    expect(screen.getByText('镇边 · 雨后的河岸')).toBeTruthy()
    expect(screen.queryByText('手记 · 夏日工作室')).toBeNull()
    fireEvent.click(screen.getByText('镇边 · 雨后的河岸'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'paint5-river', url: '/assets/paint-chapter-five/river-after-rain.webp', type: 'BACKGROUND' }))
    fireEvent.change(search, { target: { value: '不存在的素材' } })
    expect(screen.getByText('没有找到匹配的内置背景')).toBeTruthy()
  })
})
