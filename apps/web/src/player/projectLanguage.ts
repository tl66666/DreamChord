import type { StoryLocale } from '@dreamchord/story-domain'
type Defaults = { defaultVoiceLocale?: string; defaultSubtitleLocale?: string }
const locale = (value: unknown): StoryLocale => value === 'ja' ? 'ja' : 'zh'
export function projectLanguageSettings(project: Defaults, saved: string | null) {
  const defaults = { defaultVoiceLocale: locale(project.defaultVoiceLocale), defaultSubtitleLocale: locale(project.defaultSubtitleLocale) }
  try {
    const value = JSON.parse(saved || 'null')
    if (value && value.defaultVoiceLocale === defaults.defaultVoiceLocale && value.defaultSubtitleLocale === defaults.defaultSubtitleLocale) {
      return { voiceLocale: locale(value.voiceLocale), subtitleLocale: locale(value.subtitleLocale) }
    }
  } catch { /* A damaged preference must not hide the author's defaults. */ }
  return { voiceLocale: defaults.defaultVoiceLocale, subtitleLocale: defaults.defaultSubtitleLocale }
}
