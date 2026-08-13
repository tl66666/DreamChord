import { describe, expect, it, vi } from 'vitest'
import { createAudioDirector, type AudioLike } from './audioDirector'

function audio(url: string): AudioLike & { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> } {
  return { src: url, loop: false, volume: 1, currentTime: 0, play: vi.fn(() => Promise.resolve()), pause: vi.fn() }
}

describe('audio director', () => {
  it('keeps the current BGM running and replaces it only for a new track', () => {
    const created: ReturnType<typeof audio>[] = []
    const director = createAudioDirector((url) => { const item = audio(url); created.push(item); return item })

    director.playScene({ bgm: { action: 'play', url: '/rain.mp3', volume: 0.4 } }, { bgm: 1, sfx: 1, voice: 1 })
    director.playScene({ bgm: { action: 'keep' } }, { bgm: 1, sfx: 1, voice: 1 })
    director.playScene({ bgm: { action: 'play', url: '/night.mp3', volume: 0.6 } }, { bgm: 1, sfx: 1, voice: 1 })

    expect(created).toHaveLength(2)
    expect(created[0]?.pause).toHaveBeenCalledOnce()
    expect(created[1]?.loop).toBe(true)
    expect(created[1]?.volume).toBe(0.6)
  })

  it('plays SFX and voice on separate one-shot channels and clears them', () => {
    const created: ReturnType<typeof audio>[] = []
    const director = createAudioDirector((url) => { const item = audio(url); created.push(item); return item })

    director.playScene({ sfx: [{ url: '/door.ogg', volume: 0.7 }], voice: { url: '/line.wav', volume: 0.8 } }, { bgm: 1, sfx: 0.5, voice: 0.5 })
    director.stopTransient()

    expect(created).toHaveLength(2)
    expect(created[0]?.volume).toBe(0.35)
    expect(created[1]?.volume).toBe(0.4)
    expect(created.every((item) => item.pause.mock.calls.length === 1)).toBe(true)
  })

  it('clears stale transient audio when the next scene has no audio direction', () => {
    const created: ReturnType<typeof audio>[] = []
    const director = createAudioDirector((url) => { const item = audio(url); created.push(item); return item })

    director.playScene({ voice: { url: '/line.wav' }, sfx: [{ url: '/door.ogg' }] }, { bgm: 1, sfx: 1, voice: 1 })
    director.playScene(undefined, { bgm: 1, sfx: 1, voice: 1 })

    expect(created.every((item) => item.pause.mock.calls.length === 1)).toBe(true)
  })
})
