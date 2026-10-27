import type { RuntimeAudioDirection } from '../engine/types'

export interface AudioLike {
  src: string
  loop: boolean
  volume: number
  currentTime: number
  play: () => Promise<void> | void
  pause: () => void
  addEventListener?: (event: string, listener: () => void) => void
  removeEventListener?: (event: string, listener: () => void) => void
}

export interface AudioMix {
  bgm: number
  sfx: number
  voice: number
}

export interface StopTransientOptions {
  fadeOutMs?: number
}

interface AudioScheduler {
  setTimeout: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void
}

type ManagedAudio = { audio: AudioLike; baseVolume: number; ended?: () => void }

const defaultScheduler: AudioScheduler = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle),
}

function clampVolume(value: number | undefined, fallback: number) {
  return Math.max(0, Math.min(1, value ?? fallback))
}

/** Keeps story audio in three independent channels with fades, voice ducking, and lifecycle events. */
export function createAudioDirector(
  factory: (url: string) => AudioLike = (url) => new Audio(url) as unknown as AudioLike,
  scheduler: AudioScheduler = defaultScheduler,
) {
  let bgm: ManagedAudio | undefined
  let voice: ManagedAudio | undefined
  let effects: ManagedAudio[] = []
  let mix: AudioMix = { bgm: 1, sfx: 1, voice: 1 }
  const voiceEndedSubscribers = new Set<() => void>()
  const fadeTimers = new Map<AudioLike, ReturnType<typeof setTimeout>>()

  const cancelFade = (audio: AudioLike) => {
    const handle = fadeTimers.get(audio)
    if (handle !== undefined) scheduler.clearTimeout(handle)
    fadeTimers.delete(audio)
  }

  const fadeTo = (audio: AudioLike, target: number, durationMs: number, onComplete?: () => void) => {
    cancelFade(audio)
    const safeTarget = clampVolume(target, 1)
    if (durationMs <= 0 || Math.abs(audio.volume - safeTarget) < 0.001) {
      audio.volume = safeTarget
      onComplete?.()
      return
    }
    const start = audio.volume
    let elapsed = 0
    const tick = () => {
      elapsed = Math.min(durationMs, elapsed + 30)
      audio.volume = start + (safeTarget - start) * (elapsed / durationMs)
      if (elapsed >= durationMs) {
        audio.volume = safeTarget
        fadeTimers.delete(audio)
        onComplete?.()
        return
      }
      fadeTimers.set(audio, scheduler.setTimeout(tick, Math.min(30, durationMs - elapsed)))
    }
    fadeTimers.set(audio, scheduler.setTimeout(tick, Math.min(30, durationMs)))
  }

  const stopNow = (item: ManagedAudio | undefined) => {
    if (!item) return
    cancelFade(item.audio)
    if (item.ended) item.audio.removeEventListener?.('ended', item.ended)
    item.audio.pause()
    item.audio.currentTime = 0
  }

  const fadeAndStop = (item: ManagedAudio | undefined, fadeOutMs: number) => {
    if (!item) return
    if (item.ended) item.audio.removeEventListener?.('ended', item.ended)
    if (fadeOutMs <= 0) {
      stopNow(item)
      return
    }
    fadeTo(item.audio, 0, fadeOutMs, () => {
      item.audio.pause()
      item.audio.currentTime = 0
    })
  }

  const targetBgmVolume = () => {
    if (!bgm) return 0
    return clampVolume(bgm.baseVolume * mix.bgm * (voice ? 0.5 : 1), 1)
  }

  const setBgmLevel = (durationMs = 0) => {
    if (bgm) fadeTo(bgm.audio, targetBgmVolume(), durationMs)
  }

  const playSafely = (audio: AudioLike, onFailure?: () => void) => {
    try {
      void Promise.resolve(audio.play()).catch(() => onFailure?.())
    } catch {
      // Autoplay policies and unavailable media must not interrupt story playback.
      onFailure?.()
    }
  }

  const finishVoice = (item: ManagedAudio, notify: boolean) => {
    if (voice !== item) return
    if (item.ended) item.audio.removeEventListener?.('ended', item.ended)
    voice = undefined
    setBgmLevel(220)
    if (notify) voiceEndedSubscribers.forEach((listener) => listener())
  }

  const stopTransient = ({ fadeOutMs = 0 }: StopTransientOptions = {}) => {
    const oldVoice = voice
    voice = undefined
    fadeAndStop(oldVoice, fadeOutMs)
    effects.forEach((effect) => fadeAndStop(effect, fadeOutMs))
    effects = []
    setBgmLevel(fadeOutMs > 0 ? 160 : 0)
  }

  return {
    playScene(direction: RuntimeAudioDirection | undefined, nextMix: AudioMix) {
      mix = nextMix
      if (!direction) {
        stopTransient()
        return
      }

      if (direction.bgm?.action === 'stop') {
        const oldBgm = bgm
        bgm = undefined
        fadeAndStop(oldBgm, direction.bgm.fadeOutMs ?? 250)
      } else if (direction.bgm?.action === 'play' && direction.bgm.url) {
        const baseVolume = clampVolume(direction.bgm.volume, 1)
        if (bgm?.audio.src === direction.bgm.url) {
          bgm.baseVolume = baseVolume
          setBgmLevel(direction.bgm.fadeInMs ?? 0)
        } else {
          const oldBgm = bgm
          bgm = undefined
          fadeAndStop(oldBgm, direction.bgm.fadeOutMs ?? 250)
          const audio = factory(direction.bgm.url)
          audio.loop = true
          bgm = { audio, baseVolume }
          const target = targetBgmVolume()
          audio.volume = direction.bgm.fadeInMs ? 0 : target
          playSafely(audio)
          if (direction.bgm.fadeInMs) fadeTo(audio, target, direction.bgm.fadeInMs)
        }
      } else {
        setBgmLevel()
      }

      if (direction.sfx?.length) {
        for (const item of direction.sfx) {
          const audio = factory(item.url)
          const effect: ManagedAudio = { audio, baseVolume: clampVolume(item.volume, 1) }
          audio.volume = clampVolume(effect.baseVolume * mix.sfx, 1)
          const ended = () => {
            audio.removeEventListener?.('ended', ended)
            effects = effects.filter((candidate) => candidate !== effect)
          }
          effect.ended = ended
          audio.addEventListener?.('ended', ended)
          effects.push(effect)
          playSafely(audio)
        }
      }

      if (direction.voice) {
        const oldVoice = voice
        voice = undefined
        fadeAndStop(oldVoice, 100)
        const audio = factory(direction.voice.url)
        const item: ManagedAudio = { audio, baseVolume: clampVolume(direction.voice.volume, 1) }
        const ended = () => finishVoice(item, true)
        item.ended = ended
        voice = item
        audio.volume = clampVolume(item.baseVolume * mix.voice, 1)
        audio.addEventListener?.('ended', ended)
        setBgmLevel(120)
        playSafely(audio, () => finishVoice(item, true))
      }
    },
    updateMix(nextMix: AudioMix) {
      mix = nextMix
      setBgmLevel(60)
      if (voice) voice.audio.volume = clampVolume(voice.baseVolume * mix.voice, 1)
      effects.forEach((effect) => { effect.audio.volume = clampVolume(effect.baseVolume * mix.sfx, 1) })
    },
    stopTransient,
    isVoicePlaying() {
      return Boolean(voice)
    },
    onVoiceEnded(listener: () => void) {
      voiceEndedSubscribers.add(listener)
      return () => {
        voiceEndedSubscribers.delete(listener)
      }
    },
    dispose() {
      stopTransient()
      stopNow(bgm)
      bgm = undefined
      fadeTimers.forEach((handle) => scheduler.clearTimeout(handle))
      fadeTimers.clear()
      voiceEndedSubscribers.clear()
    },
  }
}
