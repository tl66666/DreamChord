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
  it('inherits music only along the reachable path and never replays preceding voice or effects', () => {
    const input: RuntimeStory = { ...story, scenes: [
      { id: 'first', event: 'ON_INIT', background: '', audio: { bgm: { action: 'play', url: '/theme.ogg', volume: .6 }, sfx: [{ url: '/bell.wav' }] }, nextSceneId: 'quiet' },
      { id: 'quiet', event: 'ON_INIT', background: '', audio: { bgm: { action: 'keep', volume: .3 } }, nextSceneId: 'mine' },
      { id: 'unrelated', event: 'ON_INIT', background: '', audio: { bgm: { action: 'play', url: '/wrong.ogg' } } },
      { ...story.scenes[1]!, audio: { voice: { url: '/my-line.wav' } } },
    ] }
    const result = startPreviewAt(input, 'mine')
    expect(result.scenes[0]?.audio).toEqual({ bgm: { action: 'play', url: '/theme.ogg', volume: .3 }, voice: { url: '/my-line.wav' } })
    expect(input.scenes[3]?.audio?.bgm).toBeUndefined()
    const stopped = { ...input, scenes: input.scenes.map((scene) => scene.id === 'quiet' ? { ...scene, audio: { bgm: { action: 'stop' as const } } } : scene) }
    expect(startPreviewAt(stopped, 'mine').scenes[0]?.audio?.bgm).toBeUndefined()
  })
})
