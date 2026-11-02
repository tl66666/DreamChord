// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { CHARACTER_KEY, loadLibraryCharacters, loadLibraryScenes } from './libraryData'
describe('new official cinema assets', () => {
  beforeEach(() => localStorage.clear())
  it('adds the paint cast and six clearly named scenes once while respecting removal', () => {
    const first = loadLibraryCharacters()
    expect(first.filter(c => c.id.startsWith('paint-'))).toHaveLength(4)
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(first.filter(c => c.id !== 'paint-xia')))
    expect(loadLibraryCharacters().some(c => c.id === 'paint-xia')).toBe(false)
    expect(loadLibraryScenes().filter(s => s.id.startsWith('paint-'))).toHaveLength(6)
  })
  it('installs curtain-call characters and the four scenes once without restoring deleted assets', () => {
    localStorage.setItem(CHARACTER_KEY, JSON.stringify([{ id: 'user', name: '我的角色', expressions: [] }]))
    const first = loadLibraryCharacters()
    expect(first.filter(c => c.id.startsWith('curtain-'))).toHaveLength(3)
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(first.filter(c => c.id !== 'curtain-zhi')))
    expect(loadLibraryCharacters().some(c => c.id === 'curtain-zhi')).toBe(false)
    expect(loadLibraryScenes().filter(s => s.id.startsWith('curtain-'))).toHaveLength(4)
  })
  it('adds new example resources once while preserving user changes and subsequent deletion', () => {
    localStorage.setItem(CHARACTER_KEY, JSON.stringify([{ id: 'user', name: '我的角色', expressions: [] }]))
    const first = loadLibraryCharacters()
    expect(first.some(c => c.name === '陆遥')).toBe(true)
    expect(first.some(c => c.id === 'user')).toBe(true)
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(first.filter(c => c.id !== 'seventh-luyao')))
    expect(loadLibraryCharacters().some(c => c.id === 'seventh-luyao')).toBe(false)
    expect(loadLibraryScenes().filter(s => s.id.startsWith('seventh-'))).toHaveLength(3)
  })
})
