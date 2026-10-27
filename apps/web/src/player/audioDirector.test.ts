import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAudioDirector, type AudioLike } from './audioDirector'

type FakeAudio = AudioLike & {
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  emit: (event: 'ended') => void
}

function audio(url: string): FakeAudio {
  const listeners = new Map<string, Set<() => void>>()
  return {
    src: url,
    loop: false,
    volume: 1,
    currentTime: 0,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    addEventListener(event, listener) {
      const group = listeners.get(event) || new Set()
      group.add(listener)
      listeners.set(event, group)
    },
    removeEventListener(event, listener) {
      listeners.get(event)?.delete(listener)
    },
    emit(event) {
      listeners.get(event)?.forEach((listener) => listener())
    },
  }
}

describe('audio director', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps the current BGM running and replaces it only for a new track', () => {
    const created: ReturnType<typeof audio>[] = []
    const director = createAudioDirector((url) => { const item = audio(url); created.push(item); return item })

    director.playScene({ bgm: { action: 'play', url: '/rain.mp3', volume: 0.4 } }, { bgm: 1, sfx: 1, voice: 1 })
    director.playScene({ bgm: { action: 'keep' } }, { bgm: 1, sfx: 1, voice: 1 })
    director.playScene({ bgm: { action: 'play', url: '/night.mp3', volume: 0.6 } }, { bgm: 1, sfx: 1, voice: 1 })
    vi.advanceTimersByTime(250)

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

  it('ducks BGM while voice plays and restores it after the voice ends', () => {
    const created: FakeAudio[] = []
    const director = createAudioDirector((url) => { const item = audio(url); created.push(item); return item })

    director.playScene({ bgm: { action: 'play', url: '/theme.ogg', volume: 0.6 } }, { bgm: 1, sfx: 1, voice: 1 })
    director.playScene({ bgm: { action: 'keep' }, voice: { url: '/line.wav' } }, { bgm: 1, sfx: 1, voice: 1 })
    vi.advanceTimersByTime(120)
    expect(created[0]?.volume).toBeCloseTo(0.3)
    expect(director.isVoicePlaying()).toBe(true)

    created[1]?.emit('ended')
    vi.advanceTimersByTime(240)
    expect(created[0]?.volume).toBeCloseTo(0.6)
    expect(director.isVoicePlaying()).toBe(false)
  })

  it('fades out the old voice when the player advances', () => {
    const created: FakeAudio[] = []
    const director = createAudioDirector((url) => { const item = audio(url); created.push(item); return item })

    director.playScene({ voice: { url: '/old.wav' } }, { bgm: 1, sfx: 1, voice: 1 })
    director.stopTransient({ fadeOutMs: 120 })
    vi.advanceTimersByTime(90)
    expect(created[0]?.volume).toBeGreaterThan(0)
    expect(created[0]?.volume).toBeLessThan(1)
    expect(created[0]?.pause).not.toHaveBeenCalled()
    vi.advanceTimersByTime(30)
    expect(created[0]?.pause).toHaveBeenCalledOnce()
    expect(created[0]?.currentTime).toBe(0)
  })

  it('notifies subscribers exactly once when the active voice finishes', () => {
    const created: FakeAudio[] = []
    const director = createAudioDirector((url) => { const item = audio(url); created.push(item); return item })
    const ended = vi.fn()
    const unsubscribe = director.onVoiceEnded(ended)

    director.playScene({ voice: { url: '/line.wav' } }, { bgm: 1, sfx: 1, voice: 1 })
    created[0]?.emit('ended')
    created[0]?.emit('ended')
    expect(ended).toHaveBeenCalledOnce()
    unsubscribe()
  })
})
