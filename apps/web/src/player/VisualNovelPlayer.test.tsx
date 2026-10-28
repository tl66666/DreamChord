// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { canScheduleAutoAdvance, parsePlayerSettings } from './VisualNovelPlayer'

describe('visual novel auto playback', () => {
  it('restores independent languages and clamps damaged or older settings', () => {
    expect(parsePlayerSettings(JSON.stringify({ subtitleLocale: 'ja', voiceLocale: 'zh', bgmVolume: 0, voiceVolume: 200, textSpeed: -1 }))).toMatchObject({ subtitleLocale: 'ja', voiceLocale: 'zh', bgmVolume: 0, voiceVolume: 1, textSpeed: 10 })
    expect(parsePlayerSettings('{bad')).toMatchObject({ subtitleLocale: 'zh', voiceLocale: 'zh' })
    expect(parsePlayerSettings('null')).toMatchObject({ subtitleLocale: 'zh' })
  })
  it('waits for both typewriter text and character voice', () => {
    const base = { isAuto: true, isTyping: false, isVoicePlaying: false, hasChoices: false, finished: false }
    expect(canScheduleAutoAdvance(base)).toBe(true)
    expect(canScheduleAutoAdvance({ ...base, isTyping: true })).toBe(false)
    expect(canScheduleAutoAdvance({ ...base, isVoicePlaying: true })).toBe(false)
    expect(canScheduleAutoAdvance({ ...base, hasChoices: true })).toBe(false)
    expect(canScheduleAutoAdvance({ ...base, finished: true })).toBe(false)
  })
})
