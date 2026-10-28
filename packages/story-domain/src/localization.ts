import { voiceTextHash } from './voiceDirection.js'

export type StoryLocale = 'zh' | 'ja'
export interface LocalizedText { text?: string; choices?: string[]; speaker?: string; sourceHash?: string }
export interface LocalizedVoice { url: string; volume?: number; textHash?: string; profileId?: string }
export interface LocalizableContent {
  text?: string
  choices?: string[]
  role?: string
  localizations?: Partial<Record<StoryLocale, LocalizedText>>
  voiceTracks?: Partial<Record<StoryLocale, LocalizedVoice>>
  originalVoice?: LocalizedVoice
}

export function resolveLocalizedContent(content: LocalizableContent, subtitleLocale: StoryLocale, voiceLocale: StoryLocale) {
  const originalHash = voiceTextHash(content.text || content.choices?.join('\n') || '')
  const candidate = subtitleLocale === 'zh' ? undefined : content.localizations?.[subtitleLocale]
  const translation = candidate?.sourceHash && candidate.sourceHash !== originalHash ? undefined : candidate
  const translatedChoices = translation?.choices
  const choicesMatch = translatedChoices?.length === content.choices?.length && translatedChoices?.every((choice) => choice.trim())
  const text = translation?.text?.trim() ? translation.text : content.text || ''
  const choices = choicesMatch ? translatedChoices : content.choices
  const fallback = subtitleLocale !== 'zh' && (
    Boolean(content.text && !translation?.text?.trim()) || Boolean(content.choices?.length && !choicesMatch)
  )
  const voice = content.voiceTracks?.[voiceLocale] || (voiceLocale === 'zh' ? content.originalVoice : undefined)
  const voiceText = voiceLocale === 'zh' ? content.text : content.localizations?.[voiceLocale]?.text
  const voiceTranslation = voiceLocale === 'ja' ? content.localizations?.ja : undefined
  const staleVoice = Boolean((voice?.textHash && (!voiceText || voice.textHash !== voiceTextHash(voiceText))) || (voiceTranslation?.sourceHash && voiceTranslation.sourceHash !== originalHash))
  return {
    text, choices, role: translation?.speaker || content.role || '', fallback,
    voice: staleVoice ? undefined : voice,
    missingVoice: !voice || staleVoice,
    staleVoice,
  }
}

export function readLocalizationFields(data: Record<string, unknown>): Pick<LocalizableContent, 'localizations' | 'voiceTracks'> {
  const localizations: LocalizableContent['localizations'] = {}
  const voiceTracks: LocalizableContent['voiceTracks'] = {}
  for (const locale of ['zh', 'ja'] as const) {
    const entry = record(record(data.localizations)?.[locale])
    if (entry) localizations[locale] = {
      ...(typeof entry.text === 'string' ? { text: entry.text } : {}),
      ...(typeof entry.speaker === 'string' ? { speaker: entry.speaker } : {}),
      ...(typeof entry.sourceHash === 'string' ? { sourceHash: entry.sourceHash } : {}),
      ...(Array.isArray(entry.choices) && entry.choices.every((item) => typeof item === 'string') ? { choices: entry.choices as string[] } : {}),
    }
    const track = record(record(data.voiceTracks)?.[locale])
    if (track && typeof track.url === 'string' && track.url.trim()) voiceTracks[locale] = {
      url: track.url,
      ...(typeof track.volume === 'number' ? { volume: Math.max(0, Math.min(1, track.volume)) } : {}),
      ...(typeof track.textHash === 'string' ? { textHash: track.textHash } : {}),
      ...(typeof track.profileId === 'string' ? { profileId: track.profileId } : {}),
    }
  }
  return { localizations, voiceTracks }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
