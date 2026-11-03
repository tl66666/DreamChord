// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { CHARACTER_KEY, SCENE_KEY, loadLibraryCharacters, loadLibraryScenes } from './libraryData'
describe('new official cinema assets', () => {
  beforeEach(() => localStorage.clear())
  it('adds the paint cast and nine clearly named scenes once while respecting removal', () => {
    const first = loadLibraryCharacters()
    expect(first.filter(c => c.id.startsWith('paint-'))).toHaveLength(4)
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(first.filter(c => c.id !== 'paint-xia')))
    expect(loadLibraryCharacters().some(c => c.id === 'paint-xia')).toBe(false)
    expect(loadLibraryScenes().filter(s => s.id.startsWith('paint-'))).toHaveLength(9)
  })
  it('adds prose scenes for existing libraries without restoring deleted old scenes or overwriting names', () => {
    localStorage.setItem(SCENE_KEY, JSON.stringify([{ id: 'paint-theatre', name: '我改过的舞台', url: '/mine.webp', type: '自定义', description: '', usage: '', updatedAt: '2026-11-01' }]))
    localStorage.setItem(`${SCENE_KEY}:paint-prologue-installed`, '1')
    const scenes = loadLibraryScenes()
    expect(scenes.find(s => s.id === 'paint-theatre')?.name).toBe('我改过的舞台')
    expect(scenes.some(s => s.id === 'paint-home')).toBe(true)
    expect(scenes.some(s => s.id === 'paint-outside')).toBe(false)
    localStorage.setItem(SCENE_KEY, JSON.stringify(scenes.filter(s => s.id !== 'paint-home')))
    expect(loadLibraryScenes().some(s => s.id === 'paint-home')).toBe(false)
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
