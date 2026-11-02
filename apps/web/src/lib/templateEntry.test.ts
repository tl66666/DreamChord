import { describe, expect, it } from 'vitest'
import { safeAuthReturnTo } from './templateEntry'
describe('creator login destination', () => {
  it('retains only the approved local template route', () => {
    expect(safeAuthReturnTo('?next=%2Fstart%2Fcurtain-call')).toBe('/start/curtain-call')
    expect(safeAuthReturnTo('?next=%2Fstart%2Fpaint-prologue')).toBe('/start/paint-prologue')
    for (const value of ['https://evil.invalid', '//evil.invalid', '/editor/private', '/\\evil.invalid']) expect(safeAuthReturnTo(`?next=${encodeURIComponent(value)}`)).toBe('/')
  })
})
