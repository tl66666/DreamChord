import { describe, expect, it } from 'vitest'
import { directVoiceLine, voiceTextHash } from './voiceDirection.js'

describe('directVoiceLine', () => {
  it('directs Japanese dialogue using the same emotion vocabulary', () => {
    expect(directVoiceLine({ role: 'yuki', text: '絶対に、あきらめない。' }).emotion).toBe('resolve')
    expect(directVoiceLine({ role: 'miya', text: 'ありがとう。一緒に帰ろう。' }).emotion).toBe('warm')
    expect(directVoiceLine({ role: 'sora', text: '怖いよ、どうしよう。' }).emotion).toBe('afraid')
  })
  it('directs hesitation without exaggerating it into anger or grief', () => {
    expect(directVoiceLine({ role: 'yuki', text: '我……真的还能重新写吗？' })).toMatchObject({
      emotion: 'afraid',
      intensity: 0.45,
      pace: 0.92,
      pauseProfile: 'dramatic',
      source: 'auto',
    })
  })

  it('recognizes restrained resolve before generic punctuation signals', () => {
    expect(directVoiceLine({ role: 'yuki', text: '这一次，我不会再把你删掉。' })).toMatchObject({
      emotion: 'resolve',
      intensity: 0.68,
      pace: 0.96,
    })
  })

  it('gives system dialogue a concise neutral delivery by default', () => {
    expect(directVoiceLine({ role: 'ghost', text: '距离审查还有十三分钟。' })).toMatchObject({
      emotion: 'neutral',
      intensity: 0.24,
      delivery: '低声清晰，像安静的守门人，保留呼吸，不用电子音或播音腔',
    })
  })

  it('keeps locked author choices while refreshing inferred fields and text hash', () => {
    const result = directVoiceLine({
      role: 'yuki',
      text: '这一次，我会留下。',
      existing: {
        emotion: 'whisper',
        intensity: 0.3,
        pace: 0.8,
        pauseProfile: 'short',
        delivery: '贴近耳语',
        lockedFields: ['emotion', 'delivery'],
        source: 'manual',
        textHash: 'old',
      },
    })

    expect(result.emotion).toBe('whisper')
    expect(result.delivery).toBe('贴近耳语')
    expect(result.pace).toBe(0.96)
    expect(result.source).toBe('manual')
    expect(result.textHash).toBe(voiceTextHash('这一次，我会留下。'))
  })

  it('produces a stable change-detection hash', () => {
    expect(voiceTextHash('同一句台词')).toBe(voiceTextHash('同一句台词'))
    expect(voiceTextHash('同一句台词')).not.toBe(voiceTextHash('不同台词'))
    expect(voiceTextHash('同一句台词')).toMatch(/^[a-f0-9]{8}$/)
  })
})
