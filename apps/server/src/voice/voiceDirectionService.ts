import { directVoiceLine, voiceTextHash, type VoiceEmotion } from '@dreamchord/story-domain'

export const VOICE_EMOTION_LABELS: Record<VoiceEmotion, string> = {
  neutral: '自然', warm: '温柔', joy: '喜悦', sad: '悲伤', tense: '紧张',
  angry: '愤怒', afraid: '害怕', resolve: '坚定', whisper: '耳语',
}

export function parseVoiceEmotion(value: string): VoiceEmotion | undefined {
  const normalized = value.trim().toLowerCase()
  const aliases: Record<string, VoiceEmotion> = {
    自然: 'neutral', 中性: 'neutral', 温柔: 'warm', 温暖: 'warm', 开心: 'joy', 喜悦: 'joy',
    悲伤: 'sad', 难过: 'sad', 紧张: 'tense', 生气: 'angry', 愤怒: 'angry',
    害怕: 'afraid', 恐惧: 'afraid', 坚定: 'resolve', 决意: 'resolve', 耳语: 'whisper', 低语: 'whisper',
  }
  return aliases[normalized] || (Object.hasOwn(VOICE_EMOTION_LABELS, normalized) ? normalized as VoiceEmotion : undefined)
}

export function resolveVoiceDirection(input: {
  role: string; text: string; mode: 'auto' | 'manual'; emotion?: string; speed?: number
}) {
  if (input.mode === 'auto') return directVoiceLine(input)
  const emotion = parseVoiceEmotion(input.emotion || '')
  const direction = directVoiceLine({
    role: input.role, text: input.text,
    overrides: { ...(emotion ? { emotion } : {}), ...(input.speed !== undefined ? { pace: input.speed } : {}) },
  })
  return { ...direction, source: 'manual' as const, lockedFields: ['emotion', 'pace'] as ('emotion' | 'pace')[] }
}

export function reviewVoiceTake(text: string, take: { textHash?: unknown } | null): 'missing' | 'stale' | 'current' {
  if (!take) return 'missing'
  return take.textHash === voiceTextHash(text) ? 'current' : 'stale'
}
