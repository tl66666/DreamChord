import { describe, expect, it } from 'vitest'
import { upgradeCurtainMusicCue } from './curtainMixUpgrade.js'
import { CURTAIN_CALL_DEMO } from '@dreamchord/story-domain'

describe('safe official demo music level upgrade', () => {
  const node = CURTAIN_CALL_DEMO.graph.nodes.find(item => item.id === 'crossed-out')!
  const original = { ...node.data, audio: { bgm: { action: 'play', url: '/assets/audio/curtain-call/backstage.ogg', volume: .18, fadeInMs: 1600, fadeOutMs: 1400 } } }
  it('changes only the legacy volume on an unchanged canonical cue', () => {
    expect(upgradeCurtainMusicCue(node.id, original)).toEqual({ ...original, audio: { bgm: { ...original.audio.bgm, volume: .55 } } })
    expect(original.audio.bgm.volume).toBe(.18)
  })
  it('preserves edited dialogue, track, levels and all unknown nodes', () => {
    expect(upgradeCurtainMusicCue(node.id, { ...original, text: '用户改写' })).toBeNull()
    expect(upgradeCurtainMusicCue(node.id, { ...original, audio: { bgm: { ...original.audio.bgm, volume: .2 } } })).toBeNull()
    expect(upgradeCurtainMusicCue(node.id, { ...original, audio: { bgm: { ...original.audio.bgm, url: '/mine.ogg' } } })).toBeNull()
    expect(upgradeCurtainMusicCue('unknown', original)).toBeNull()
  })
})
