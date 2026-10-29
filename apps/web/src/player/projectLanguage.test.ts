import { describe, expect, it } from 'vitest'
import { projectLanguageSettings } from './projectLanguage'
describe('story language defaults', () => {
  it('starts with Japanese audio and Chinese text when the author selects them', () => {
    expect(projectLanguageSettings({ defaultVoiceLocale: 'ja', defaultSubtitleLocale: 'zh' }, null)).toEqual({ voiceLocale: 'ja', subtitleLocale: 'zh' })
  })
  it('restores a reader choice only when it was made for the current author defaults', () => {
    const project = { defaultVoiceLocale: 'ja' as const, defaultSubtitleLocale: 'zh' as const }
    expect(projectLanguageSettings(project, JSON.stringify({ ...project, voiceLocale: 'zh', subtitleLocale: 'ja' }))).toEqual({ voiceLocale: 'zh', subtitleLocale: 'ja' })
    expect(projectLanguageSettings(project, JSON.stringify({ defaultVoiceLocale: 'zh', defaultSubtitleLocale: 'zh', voiceLocale: 'zh' }))).toEqual({ voiceLocale: 'ja', subtitleLocale: 'zh' })
  })
  it('keeps older stories and damaged preferences readable in Chinese', () => {
    expect(projectLanguageSettings({}, '{bad')).toEqual({ voiceLocale: 'zh', subtitleLocale: 'zh' })
  })
})
