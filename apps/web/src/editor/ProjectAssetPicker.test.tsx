// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProjectAssetPicker from './ProjectAssetPicker'

const background = { id: 'background', name: '雨夜街道', type: 'BACKGROUND', url: '/uploads/rain.webp', createdAt: '2026-07-12T00:00:00Z' }

describe('project asset picker', () => {
  afterEach(cleanup)
  it('returns the selected asset to the explicit card field target', () => {
    const select = vi.fn()
    render(<ProjectAssetPicker assets={[background]} target={{ cardId: 'card-2', field: 'background' }} onSelect={select} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '选择雨夜街道' }))
    expect(select).toHaveBeenCalledWith({ cardId: 'card-2', field: 'background' }, background)
  })
})
