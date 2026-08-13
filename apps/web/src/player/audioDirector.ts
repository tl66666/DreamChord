import type { RuntimeAudioDirection } from '../engine/types'

export interface AudioLike {
  src: string
  loop: boolean
  volume: number
  currentTime: number
  play: () => Promise<void> | void
  pause: () => void
}

export interface AudioMix {
  bgm: number
  sfx: number
  voice: number
}

type ManagedAudio = { audio: AudioLike; baseVolume: number }

function clampVolume(value: number | undefined, fallback: number) {
  return Math.max(0, Math.min(1, value ?? fallback))
}

function stop(item: AudioLike | undefined) {
  if (!item) return
  item.pause()
  item.currentTime = 0
}

/** Keeps story audio in three independent channels: looping BGM, voice, and one-shot SFX. */
export function createAudioDirector(factory: (url: string) => AudioLike = (url) => new Audio(url)) {
  let bgm: ManagedAudio | undefined
  let voice: ManagedAudio | undefined
  let effects: ManagedAudio[] = []
  let mix: AudioMix = { bgm: 1, sfx: 1, voice: 1 }

  const playSafely = (audio: AudioLike) => {
    try {
      void Promise.resolve(audio.play()).catch(() => undefined)
    } catch {
      // Autoplay policies and unavailable media must not interrupt story playback.
    }
  }

  const applyVolumes = () => {
    if (bgm) bgm.audio.volume = clampVolume(bgm.baseVolume * mix.bgm, 1)
    if (voice) voice.audio.volume = clampVolume(voice.baseVolume * mix.voice, 1)
    effects.forEach((effect) => { effect.audio.volume = clampVolume(effect.baseVolume * mix.sfx, 1) })
  }

  const stopTransient = () => {
    stop(voice?.audio)
    voice = undefined
    effects.forEach((effect) => stop(effect.audio))
    effects = []
  }

  return {
    playScene(direction: RuntimeAudioDirection | undefined, nextMix: AudioMix) {
      mix = nextMix
      if (!direction) {
        stopTransient()
        applyVolumes()
        return
      }

      if (direction.bgm?.action === 'stop') {
        stop(bgm?.audio)
        bgm = undefined
      } else if (direction.bgm?.action === 'play' && direction.bgm.url) {
        const baseVolume = clampVolume(direction.bgm.volume, 1)
        if (bgm?.audio.src === direction.bgm.url) {
          bgm.baseVolume = baseVolume
        } else {
          stop(bgm?.audio)
          const audio = factory(direction.bgm.url)
          audio.loop = true
          bgm = { audio, baseVolume }
          playSafely(audio)
        }
      }

      if (direction.sfx?.length) {
        for (const item of direction.sfx) {
          const audio = factory(item.url)
          effects.push({ audio, baseVolume: clampVolume(item.volume, 1) })
          playSafely(audio)
        }
      }
      if (direction.voice) {
        stop(voice?.audio)
        const audio = factory(direction.voice.url)
        voice = { audio, baseVolume: clampVolume(direction.voice.volume, 1) }
        playSafely(audio)
      }
      applyVolumes()
    },
    updateMix(nextMix: AudioMix) {
      mix = nextMix
      applyVolumes()
    },
    stopTransient,
    dispose() {
      stopTransient()
      stop(bgm?.audio)
      bgm = undefined
    },
  }
}
