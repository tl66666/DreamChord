import { describe, expect, it } from 'vitest'
import { startPreviewAt } from './previewStart'
import { createRuntimeEngine } from './runtime'
import type { RuntimeStory } from './types'
describe('previewing a selected card', () => {
  const story: RuntimeStory = { id: 's', title: 's', version: '1', initialState: { nodeCount: 2, realityVersion: 0, constantNodeLocked: false, characters: { yuki: 'normal', ren: 'normal', miya: 'normal', sora: 'normal', ghost: 'normal' }, activeUIEvents: [], variables: {} }, scenes: [{ id: 'first', event: 'ON_INIT', background: '', nextSceneId: null }, { id: 'mine', event: 'ON_INIT', background: '', dialogue: { role: '许栀', text: '我写的结局' }, nextSceneId: null }] }
  it('starts directly at the requested playable card and preserves its ending route', () => {
    const engine = createRuntimeEngine(startPreviewAt(story, 'mine'))
    expect(engine.currentScene()?.id).toBe('mine')
    expect(engine.next()).toBe(false)
    expect(story.scenes[0]!.id).toBe('first')
    expect(startPreviewAt(story, 'missing')).toBe(story)
  })
})
