// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProjectAssetPicker from './ProjectAssetPicker'

const background = { id: 'background', name: '雨夜街道', type: 'BACKGROUND', url: '/uploads/rain.webp', createdAt: '2026-07-12T00:00:00Z' }
const cg = { id: 'cg', name: '天台重逢', type: 'CG', url: '/uploads/rooftop.webp', createdAt: '2026-07-12T00:00:00Z' }
const bgm = { id: 'bgm', name: '雨声', type: 'BGM', url: '/uploads/rain.mp3', createdAt: '2026-07-12T00:00:00Z' }
const other = { id: 'other', name: '设定文档', type: 'OTHER', url: '/uploads/note.txt', createdAt: '2026-07-12T00:00:00Z' }

describe('project asset picker', () => {
  afterEach(cleanup)
  it('returns the selected asset to the explicit card field target', () => {
    const select = vi.fn()
    render(<ProjectAssetPicker assets={[background]} target={{ cardId: 'card-2', field: 'background' }} onSelect={select} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '选择雨夜街道' }))
    expect(select).toHaveBeenCalledWith({ cardId: 'card-2', field: 'background' }, background)
  })

  it('offers both backgrounds and CGs as full-screen story images', () => {
    const select = vi.fn()
    const target = { cardId: 'card-3', field: 'background' } as const
    render(<ProjectAssetPicker assets={[background, cg, bgm, other]} target={target} onSelect={select} onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '选择背景 / CG' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '选择雨夜街道' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '选择天台重逢' }))
    expect(screen.queryByRole('button', { name: '选择雨声' })).toBeNull()
    expect(screen.queryByRole('button', { name: '选择设定文档' })).toBeNull()
    expect(select).toHaveBeenCalledWith(target, cg)
  })
})
