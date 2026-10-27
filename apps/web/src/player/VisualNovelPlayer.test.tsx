// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { canScheduleAutoAdvance } from './VisualNovelPlayer'

describe('visual novel auto playback', () => {
  it('waits for both typewriter text and character voice', () => {
    const base = { isAuto: true, isTyping: false, isVoicePlaying: false, hasChoices: false, finished: false }
    expect(canScheduleAutoAdvance(base)).toBe(true)
    expect(canScheduleAutoAdvance({ ...base, isTyping: true })).toBe(false)
    expect(canScheduleAutoAdvance({ ...base, isVoicePlaying: true })).toBe(false)
    expect(canScheduleAutoAdvance({ ...base, hasChoices: true })).toBe(false)
    expect(canScheduleAutoAdvance({ ...base, finished: true })).toBe(false)
  })
})
