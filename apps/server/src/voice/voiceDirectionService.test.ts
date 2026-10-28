import { describe, expect, it } from 'vitest'
import { resolveVoiceDirection, reviewVoiceTake } from './voiceDirectionService.js'
import { voiceTextHash } from '@dreamchord/story-domain'

describe('voice direction service', () => {
  it('adapts a new line without letting the previous manual emotion override it', () => {
    expect(resolveVoiceDirection({ role: '雪', text: '我……真的还能重新写吗？', mode: 'auto', emotion: '愤怒', speed: 1.4 }))
      .toMatchObject({ emotion: 'afraid', pace: 0.92, source: 'auto' })
  })

  it('keeps explicit emotion and speed with matching performance instructions', () => {
    expect(resolveVoiceDirection({ role: '雪', text: '你好。', mode: 'manual', emotion: '坚定', speed: 0.9 }))
      .toMatchObject({ emotion: 'resolve', pace: 0.9, delivery: expect.stringContaining('坚定'), source: 'manual' })
  })

  it('marks a take stale after its dialogue changes', () => {
    expect(reviewVoiceTake('新台词', { textHash: voiceTextHash('旧台词') })).toBe('stale')
    expect(reviewVoiceTake('新台词', { textHash: voiceTextHash('新台词') })).toBe('current')
    expect(reviewVoiceTake('新台词', null)).toBe('missing')
  })
})
