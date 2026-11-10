// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { CHARACTER_KEY, SCENE_KEY, loadLibraryCharacters, loadLibraryScenes } from './libraryData'
describe('new official cinema assets', () => {
  beforeEach(() => localStorage.clear())
  it('adds the fourth chapter cast once to existing libraries without restoring deleted entries', () => {
    localStorage.setItem(CHARACTER_KEY, JSON.stringify([{ id: 'user', name: '我的角色', expressions: [] }]))
    localStorage.setItem(`${CHARACTER_KEY}:paint-prologue-installed`, '1')
    const first = loadLibraryCharacters()
    for (const [id, name, url] of [['paint-liu', '刘济安', '/assets/paint-world/liu-jian-stage.webp'], ['paint-shen', '沈芸', '/assets/paint-world/shen-yun-stage.webp']]) {
      expect(first.find(c => c.id === id)).toMatchObject({ name, expressions: [{ id: 'normal', url }] })
    }
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(first.filter(c => c.id !== 'paint-liu')))
    expect(loadLibraryCharacters().some(c => c.id === 'paint-liu')).toBe(false)
    expect(loadLibraryCharacters().some(c => c.id === 'user')).toBe(true)
  })
  it('adds fourth chapter scenes once without replacing or resurrecting user entries', () => {
    localStorage.setItem(SCENE_KEY, JSON.stringify([{ id: 'custom-scene', name: '我的场景', url: '/mine.webp', type: '自定义', description: '', usage: '', updatedAt: '2026-11-01' }]))
    const first = loadLibraryScenes()
    expect(first.find(s => s.id === 'paint4-commission')?.url).toBe('/assets/paint-chapter-four/commission-desk.webp')
    expect(first.find(s => s.id === 'paint4-hall')?.url).toBe('/assets/paint-chapter-four/hall-afternoon.webp')
    localStorage.setItem(SCENE_KEY, JSON.stringify(first.filter(s => s.id !== 'paint4-hall')))
    expect(loadLibraryScenes().some(s => s.id === 'paint4-hall')).toBe(false)
    expect(loadLibraryScenes().find(s => s.id === 'custom-scene')?.name).toBe('我的场景')
  })
  it('adds the paint cast and nine clearly named scenes once while respecting removal', () => {
    const first = loadLibraryCharacters()
    expect(first.filter(c => c.id.startsWith('paint-'))).toHaveLength(6)
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
