import type { VoiceDirection, VoiceDirectionField, VoiceEmotion } from './types.js'

interface DirectVoiceLineInput {
  role: string
  text: string
  existing?: VoiceDirection
  overrides?: Partial<Pick<VoiceDirection, VoiceDirectionField>>
}

type DirectionPreset = Pick<VoiceDirection, VoiceDirectionField>

const ROLE_DEFAULTS: Record<string, Pick<DirectionPreset, 'intensity' | 'pace' | 'delivery'>> = {
  yuki: { intensity: 0.34, pace: 0.98, delivery: '年轻清亮、自然呼吸，不卖萌，句尾收住' },
  ren: { intensity: 0.4, pace: 0.9, delivery: '年轻偏低、压住怒意，短句不要故作深沉' },
  miya: { intensity: 0.34, pace: 0.96, delivery: '温暖可靠，语气稳定，保留轻微笑意' },
  sora: { intensity: 0.32, pace: 0.94, delivery: '轻而通透，像刚学会表达，但不要机械断字' },
  ghost: { intensity: 0.24, pace: 1, delivery: '无性别、清晰、像系统播报，但不要拖长句尾' },
}

const DELIVERY: Record<VoiceEmotion, string> = {
  neutral: '自然陈述，重音克制，不额外煽情',
  warm: '语气放松温和，笑意很轻，不甜腻',
  joy: '明亮但不过度兴奋，保持真实呼吸',
  sad: '压住情绪，不哭喊，让停顿承载难过',
  tense: '呼吸略紧，信息清楚，不要一味加快',
  angry: '怒意集中在关键词，避免全句喊叫',
  afraid: '迟疑、轻微气息不稳，尾音保持可懂度',
  resolve: '克制但坚定，关键词稍加重，句尾落稳',
  whisper: '近距离低声，保留清晰辅音和自然气息',
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeRole(role: string) {
  const normalized = role.trim().toLowerCase()
  const aliases: Record<string, string> = { 雪: 'yuki', 影: 'ren', 宫: 'miya', 空: 'sora', 系统幽灵: 'ghost' }
  return aliases[role.trim()] || normalized
}

function inferEmotion(text: string): { emotion: VoiceEmotion; intensity: number; pace: number } {
  if (/(低声|耳语|别让.*听见|嘘)/.test(text)) return { emotion: 'whisper', intensity: 0.32, pace: 0.84 }
  if (/(这一次|我会|我决定|一定|不会再|必须|留下)/.test(text)) return { emotion: 'resolve', intensity: 0.68, pace: 0.96 }
  if (/(凭什么|闭嘴|够了|住手|你没有资格|！{2,})/.test(text)) return { emotion: 'angry', intensity: 0.76, pace: 1.04 }
  if (/(……|…|不可能|怎么办|害怕|怕).*[？?]|(真的|还能|会不会).*[？?]/.test(text)) return { emotion: 'afraid', intensity: 0.45, pace: 0.92 }
  if (/(对不起|失去|忘记|消失|退稿|没能|再也)/.test(text)) return { emotion: 'sad', intensity: 0.56, pace: 0.88 }
  if (/(快|来不及|倒计时|危险|立刻|马上|只剩)/.test(text)) return { emotion: 'tense', intensity: 0.58, pace: 1.06 }
  if (/(太好了|成功了|终于|真好|喜欢)/.test(text)) return { emotion: 'joy', intensity: 0.55, pace: 1.02 }
  if (/(谢谢|一起|陪你|没关系|相信你)/.test(text)) return { emotion: 'warm', intensity: 0.42, pace: 0.96 }
  return { emotion: 'neutral', intensity: 0.34, pace: 1 }
}

/** A small stable hash for stale-take detection; it is not intended for security. */
export function voiceTextHash(text: string) {
  let hash = 0x811c9dc5
  for (const character of text.normalize('NFC')) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function directVoiceLine(input: DirectVoiceLineInput): VoiceDirection {
  const role = normalizeRole(input.role)
  const roleDefault = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.yuki!
  const inferred = inferEmotion(input.text)
  const pauseProfile: VoiceDirection['pauseProfile'] = /……|…|——/.test(input.text)
    ? 'dramatic'
    : input.text.length <= 12
      ? 'short'
      : 'natural'
  const isRoleNeutral = inferred.emotion === 'neutral'
  const automatic: VoiceDirection = {
    emotion: inferred.emotion,
    intensity: isRoleNeutral ? roleDefault.intensity : inferred.intensity,
    pace: isRoleNeutral ? roleDefault.pace : inferred.pace,
    pauseProfile,
    delivery: isRoleNeutral ? roleDefault.delivery : DELIVERY[inferred.emotion],
    lockedFields: [],
    source: 'auto',
    textHash: voiceTextHash(input.text),
  }

  const withOverrides: VoiceDirection = {
    ...automatic,
    ...input.overrides,
    intensity: clamp(input.overrides?.intensity ?? automatic.intensity, 0, 1),
    pace: clamp(input.overrides?.pace ?? automatic.pace, 0.75, 1.2),
  }
  if (!input.existing) return withOverrides

  const locked = new Set(input.existing.lockedFields)
  const merged = { ...withOverrides }
  for (const field of locked) {
    ;(merged as unknown as Record<string, unknown>)[field] = input.existing[field]
  }
  merged.lockedFields = [...input.existing.lockedFields]
  merged.source = input.existing.source === 'manual' || locked.size > 0 ? 'manual' : 'auto'
  merged.textHash = voiceTextHash(input.text)
  return merged
}
