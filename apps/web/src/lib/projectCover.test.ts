import { describe, expect, it } from 'vitest'
import { projectCover } from './projectCover'
describe('project cover migration', () => {
  it('gives built-in stories their own updated covers', () => {
    expect(projectCover({ id: 'dreamchord-first-thread', cover: '/assets/hero.png' })).toBe('/assets/covers/first-thread.webp')
    expect(projectCover({ id: 'demo-project-001', cover: '/assets/hero.png' })).toBe('/assets/backgrounds/bg-sakura.png')
  })
  it('uses a quiet draft cover while preserving custom uploaded art', () => {
    expect(projectCover({ id: 'mine', cover: '' })).toBe('/assets/covers/story-draft.webp')
    expect(projectCover({ id: 'dreamchord-first-thread', cover: '/uploads/my-cover.png' })).toBe('/uploads/my-cover.png')
  })
})
