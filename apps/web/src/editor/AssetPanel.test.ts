// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
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
})
