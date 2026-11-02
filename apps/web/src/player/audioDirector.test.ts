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

  it('reuses a relative music URL even when the browser resolves audio.src to an absolute URL', () => {
    const created: FakeAudio[] = []
    const director = createAudioDirector((url) => { const item = audio(`http://localhost${url}`); created.push(item); return item })
    director.playScene({ bgm: { action: 'play', url: '/theme.ogg', volume: .5 } }, { bgm: 1, sfx: 1, voice: 1 })
    created[0]!.currentTime = 15
    director.playScene({ bgm: { action: 'play', url: '/theme.ogg', volume: .7 } }, { bgm: 1, sfx: 1, voice: 1 })
    expect(created).toHaveLength(1)
    expect(created[0]!.currentTime).toBe(15)
    expect(created[0]!.volume).toBe(.7)
  })

  it('adjusts continuing music including zero without restarting playback', () => {
    const created: FakeAudio[] = []
    const director = createAudioDirector((url) => { const item = audio(url); created.push(item); return item })
    director.playScene({ bgm: { action: 'play', url: '/theme.ogg', volume: .8 } }, { bgm: .5, sfx: 1, voice: 1 })
    director.playScene({ bgm: { action: 'keep', volume: .6, fadeInMs: 300 } }, { bgm: .5, sfx: 1, voice: 1 })
    vi.advanceTimersByTime(300)
    expect(created[0]!.volume).toBeCloseTo(.3)
    director.playScene({ bgm: { action: 'keep', volume: 0 } }, { bgm: .5, sfx: 1, voice: 1 })
    expect(created[0]!.volume).toBe(0)
    expect(created).toHaveLength(1)
    expect(created[0]!.pause).not.toHaveBeenCalled()
  })

  it('preserves an authored long music transition while voice ducking starts and ends', () => {
    const created: FakeAudio[] = []
    const director = createAudioDirector((url) => { const item = audio(url); created.push(item); return item })
    const mix = { bgm: 1, sfx: 1, voice: 1 }
    director.playScene({ bgm: { action: 'play', url: '/theme.ogg', volume: 1 } }, mix)
    director.playScene({ bgm: { action: 'keep', volume: 0, fadeInMs: 3000 }, voice: { url: '/line.wav' } }, mix)
    vi.advanceTimersByTime(120)
    expect(created[0]!.volume).toBeGreaterThan(.6)
    expect(created[0]!.volume).toBeLessThan(.75)
    created[1]!.emit('ended')
    vi.advanceTimersByTime(1380)
    expect(created[0]!.volume).toBeCloseTo(.5)
    vi.advanceTimersByTime(1500)
    expect(created[0]!.volume).toBe(0)
  })

  it('retries blocked initial music on the next story interaction without creating another track', async () => {
    const music = audio('/theme.ogg')
    music.play.mockRejectedValueOnce(new Error('autoplay blocked'))
    const director = createAudioDirector(() => music)
    const mix = { bgm: 1, sfx: 1, voice: 1 }
    director.playScene({ bgm: { action: 'play', url: '/theme.ogg', volume: .6 } }, mix)
    await Promise.resolve()
    director.playScene(undefined, mix)
    await Promise.resolve()
    expect(music.play).toHaveBeenCalledTimes(2)
    expect(music.volume).toBe(.6)
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
    expect(created[0]?.volume).toBeCloseTo(0.45)
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
