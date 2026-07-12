// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
