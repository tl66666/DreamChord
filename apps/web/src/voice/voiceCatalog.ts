import type { VoiceProfile } from '../api/client'

type CatalogEntry = { name: string; legacy: string[]; description: string; traits: string[]; roles: string[]; example?: string }
const catalog: Record<string, CatalogEntry> = {
  'cast-voice-yuki': { name: '晴音 · 清亮少女', legacy: ['雪 · 清亮而倔强'], description: '明亮清透，带一点不服输的劲头。适合校园对话、惊讶和坚定独白。', traits: ['清亮', '有朝气', '校园'], roles: ['少女', '主角'], example: '雪' },
  'cast-voice-ren': { name: '凛川 · 清冷青年', legacy: ['影 · 克制的锋芒'], description: '音色偏低，语气克制、句尾利落。适合冷静男主、质问与悬疑对白。', traits: ['清冷', '克制', '悬疑'], roles: ['青年', '男主'], example: '影' },
  'cast-voice-miya': { name: '知夏 · 温柔女声', legacy: ['宫 · 温柔有分寸'], description: '温暖平稳，亲近又有分寸。适合可靠学姐、日常闲谈与安慰。', traits: ['温柔', '知性', '日常'], roles: ['学姐', '成熟女性'], example: '宫' },
  'cast-voice-sora': { name: '羽澄 · 轻柔少女', legacy: ['空 · 轻盈的好奇'], description: '轻盈柔和，留有自然停顿。适合好奇的少女、初次相遇与内心独白。', traits: ['轻柔', '空灵', '好奇'], roles: ['少女', '独白'], example: '空' },
  'cast-voice-ghost': { name: '砚舟 · 低沉男声', legacy: ['守门人 · 低声的记录'], description: '低声清晰，叙述沉着。适合旁白、守护者、提醒与秘密揭示。', traits: ['低沉', '沉着', '叙述'], roles: ['旁白', '成熟男性'], example: '系统幽灵' },
  'starter-voice-profile-dreamchord-xingli': { name: '星璃 · 明净女声', legacy: ['星璃・清澈'], description: '轻巧明净的中文声线，适合短对白、教程与轻快的日常叙述。', traits: ['明净', '轻快'], roles: ['少女', '引导'] },
  'starter-voice-profile-dreamchord-wulan': { name: '雾岚 · 轻语女声', legacy: ['雾岚・轻语'], description: '柔和安静的中文声线，适合温柔对白与近距离独白。', traits: ['轻语', '柔和'], roles: ['少女', '独白'] },
  'starter-voice-profile-dreamchord-muchuan': { name: '暮川 · 稳重男声', legacy: ['暮川・沉稳'], description: '平稳的中文男声，适合可靠配角、说明与叙事段落。', traits: ['稳重', '叙述'], roles: ['青年', '旁白'] },
}
export const languageName = (language: string) => ({ zh: '中文', ja: '日语', en: '英语' })[language.split('-')[0]] || language
export function voiceLanguages(profile: VoiceProfile) {
  return [...new Set([...(profile.references || []).filter((reference) => reference.status !== 'disabled' && reference.status !== 'revoked').map((reference) => reference.language.split('-')[0]), ...(profile.previewUrl || !profile.references?.length ? [profile.language.split('-')[0]] : [])])]
}
export function voicePreviewUrl(profile: VoiceProfile, language: string) {
  return profile.references.find((reference) => reference.status !== 'disabled' && reference.status !== 'revoked' && reference.language.split('-')[0] === language)?.asset.url || (profile.language.split('-')[0] === language ? profile.previewUrl || undefined : undefined)
}
export function hasVoiceReference(profile: VoiceProfile) { return profile.references.some((reference) => reference.status !== 'disabled' && reference.status !== 'revoked') }
export function voicePresentation(profile: VoiceProfile) {
  const entry = catalog[profile.id]
  const originalName = !entry || ![entry.name, ...entry.legacy].includes(profile.name)
  let tags: string[] = []
  try { const parsed: unknown = JSON.parse(profile.tags || '[]'); if (Array.isArray(parsed)) tags = parsed.filter((item): item is string => typeof item === 'string') } catch { /* A missing tag list does not prevent audition. */ }
  const defaultDescription = !profile.description || profile.description.endsWith('支持中文和日文；两种语言均使用同一基础声线。')
  return { name: !originalName && entry ? entry.name : profile.name, description: (defaultDescription ? entry?.description : profile.description) || '试听这条声线，再按人物性格分配。', traits: entry?.traits || tags, roles: entry?.roles || [profile.ageTone, profile.genderTone].filter((value): value is string => Boolean(value)), example: entry?.example, official: Boolean(entry) }
}
export function presentVoiceProfile(profile: VoiceProfile): VoiceProfile { return { ...profile, name: voicePresentation(profile).name } }
