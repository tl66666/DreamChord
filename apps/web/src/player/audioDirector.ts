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

type VolumeTarget = { volume: number }
type ManagedAudio = { audio: AudioLike; baseVolume: number; gain?: VolumeTarget; sourceUrl?: string; needsPlayback?: boolean; ended?: () => void }

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
  const fadeTimers = new Map<VolumeTarget, ReturnType<typeof setTimeout>>()
  let duckLevel = 1
  const renderBgmLevel = () => { if (bgm) bgm.audio.volume = clampVolume(bgm.baseVolume * mix.bgm * duckLevel, 1) }
  const duckGain: VolumeTarget = { get volume() { return duckLevel }, set volume(value) { duckLevel = value; renderBgmLevel() } }

  const cancelFade = (audio: VolumeTarget) => {
    const handle = fadeTimers.get(audio)
    if (handle !== undefined) scheduler.clearTimeout(handle)
    fadeTimers.delete(audio)
  }

  const fadeTo = (audio: VolumeTarget, target: number, durationMs: number, onComplete?: () => void) => {
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
    if (item.gain) cancelFade(item.gain)
    cancelFade(item.audio)
    if (item.ended) item.audio.removeEventListener?.('ended', item.ended)
    item.audio.pause()
    item.audio.currentTime = 0
  }

  const fadeAndStop = (item: ManagedAudio | undefined, fadeOutMs: number) => {
    if (!item) return
    if (item.gain) cancelFade(item.gain)
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

  const setBgmLevel = (durationMs = 0) => {
    fadeTo(duckGain, voice ? .75 : 1, durationMs)
  }

  const playSafely = (audio: AudioLike, onFailure?: () => void) => {
    try {
      void Promise.resolve(audio.play()).catch(() => onFailure?.())
    } catch {
      // Autoplay policies and unavailable media must not interrupt story playback.
      onFailure?.()
    }
  }

  const resumeBlockedMusic = () => {
    const item = bgm
    if (!item?.needsPlayback) return
    item.needsPlayback = false
    playSafely(item.audio, () => { item.needsPlayback = true })
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
        resumeBlockedMusic()
        return
      }

      if (direction.bgm?.action === 'stop') {
        const oldBgm = bgm
        bgm = undefined
        fadeAndStop(oldBgm, direction.bgm.fadeOutMs ?? 250)
      } else if (direction.bgm?.action === 'play' && direction.bgm.url) {
        const baseVolume = clampVolume(direction.bgm.volume, 1)
        if (bgm?.sourceUrl === direction.bgm.url) {
          fadeTo(bgm.gain!, baseVolume, direction.bgm.fadeInMs ?? 0)
        } else {
          const oldBgm = bgm
          bgm = undefined
          fadeAndStop(oldBgm, direction.bgm.fadeOutMs ?? 250)
          const audio = factory(direction.bgm.url)
          audio.loop = true
          const item: ManagedAudio = { audio, baseVolume: direction.bgm.fadeInMs ? 0 : baseVolume, sourceUrl: direction.bgm.url, needsPlayback: true }
          item.gain = { get volume() { return item.baseVolume }, set volume(value) { item.baseVolume = value; if (bgm === item) renderBgmLevel() } }
          bgm = item
          renderBgmLevel()
          if (direction.bgm.fadeInMs) fadeTo(item.gain, baseVolume, direction.bgm.fadeInMs)
        }
      } else {
        if (bgm && direction.bgm?.action === 'keep' && direction.bgm.volume !== undefined) {
          fadeTo(bgm.gain!, clampVolume(direction.bgm.volume, bgm.baseVolume), direction.bgm.fadeInMs ?? 0)
        }
        setBgmLevel()
      }
      resumeBlockedMusic()

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
