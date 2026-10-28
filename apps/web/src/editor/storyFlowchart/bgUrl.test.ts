import { describe, expect, it } from 'vitest'
import { resolveBgUrl } from './bgUrl'
describe('background URL resolution', () => {
  it('keeps library handoff asset URLs intact instead of wrapping them as IDs', () => {
    expect(resolveBgUrl('/assets/backgrounds/bg-classroom.png', [])).toBe('/assets/backgrounds/bg-classroom.png')
    expect(resolveBgUrl('/uploads/my-room.webp', [])).toBe('/uploads/my-room.webp')
  })
  it('continues to resolve library IDs and legacy IDs', () => {
    expect(resolveBgUrl('custom', [{ id: 'custom', url: '/uploads/custom.webp' }])).toBe('/uploads/custom.webp')
    expect(resolveBgUrl('bg-sakura', [])).toBe('/assets/backgrounds/bg-sakura.png')
  })
})
