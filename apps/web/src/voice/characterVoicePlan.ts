import { readLocalizationFields, voiceTextHash, type StoryLocale } from '@dreamchord/story-domain'
import type { Node } from '@xyflow/react'
import type { VoiceProfile } from '../api/client'
import { resolveCharacterName } from '../engine/characters'

export interface PlannedVoiceLine {
  nodeId: string; role: string; sourceText: string; sourceHash: string; spokenText?: string
  originalJa?: string; originalTrackUrl?: string
  characterId: string; characterName: string; profileId: string; referenceId: string
}
export function planCharacterVoices(nodes: Node[], profiles: VoiceProfile[], projectId: string, locale: StoryLocale, regenerate = false) {
  const pending: PlannedVoiceLine[] = []
  let ready = 0, unbound = 0
  for (const node of nodes) {
    if (node.type !== 'dialogue' || typeof node.data.text !== 'string' || !node.data.text.trim()) continue
    const role = String(node.data.role || '')
    const sourceText = node.data.text
    const sourceHash = voiceTextHash(sourceText)
    const fields = readLocalizationFields(node.data)
    const ja = fields.localizations?.ja
    const spokenText = locale === 'zh' ? sourceText : ja?.text && (!ja.sourceHash || ja.sourceHash === sourceHash) ? ja.text : undefined
    const track = fields.voiceTracks?.[locale]
    const legacyVoice = locale === 'zh' ? (node.data.audio as { voice?: { url?: string } } | undefined)?.voice?.url : undefined
    const profile = profiles.find((item) => item.status === 'active' && item.bindings.some((binding) => binding.project.id === projectId && [binding.character.id, binding.character.name].some((value) => value === role || value === resolveCharacterName(role))))
    const changedVoice = profile && track?.profileId && profile.id !== track.profileId
    if (!regenerate && !changedVoice && ((track?.url && spokenText && (!track.textHash || track.textHash === voiceTextHash(spokenText))) || (!track && legacyVoice))) { ready++; continue }
    const binding = profile?.bindings.find((item) => item.project.id === projectId && [item.character.id, item.character.name].some((value) => value === role || value === resolveCharacterName(role)))
    const references = profile?.references.filter((item) => item.status === 'active') || []
    const reference = references.find((item) => item.language.startsWith(locale)) || references[0]
    if (!profile || !binding || !reference) { unbound++; continue }
    pending.push({ nodeId: node.id, role, sourceText, sourceHash, spokenText, originalJa: ja?.text, originalTrackUrl: track?.url, characterId: binding.character.id, characterName: binding.character.name, profileId: profile.id, referenceId: reference.id })
  }
  return { pending, ready, unbound }
}
export const VOICE_BINDINGS_CHANGED = 'dreamchord:voice-bindings-changed'
export const VOICE_PREFERENCE_CHANGED = 'dreamchord:voice-preference-changed'
export function projectVoiceLocale(projectId?: string): StoryLocale {
  try { return localStorage.getItem(`dreamchord_voice_locale_${projectId}`) === 'ja' ? 'ja' : 'zh' } catch { return 'zh' }
}
export function saveProjectVoiceLocale(projectId: string, locale: StoryLocale) {
  try { localStorage.setItem(`dreamchord_voice_locale_${projectId}`, locale) } catch { /* Saved story defaults remain available when storage is blocked. */ }
  window.dispatchEvent(new Event(VOICE_PREFERENCE_CHANGED))
}
