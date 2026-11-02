import { describe, expect, it } from 'vitest'
import type { VoiceProfile } from '../api/client'
import { presentVoiceProfile, voiceLanguages, voicePresentation, voicePreviewUrl } from './voiceCatalog'
const voice = { id: 'cast-voice-yuki', name: '雪 · 清亮而倔强', language: 'zh', tags: '[]', references: [{ id: 'zh', language: 'zh', status: 'active', asset: { url: '/zh.wav' } }], previewUrl: '/zh.wav', bindings: [] } as unknown as VoiceProfile
describe('voice catalog presentation', () => {
  it('explains the new demo voice by timbre and a suitable character', () => {
    const result = voicePresentation({ ...voice, id: 'curtain-voice-zhi', name: '许栀 · 温柔而坦率' })
    expect(result.official).toBe(true)
    expect(result.example).toBe('许栀')
    expect(result.roles).toContain('青年女性')
  })
  it('classifies the new cinema cast as official and explains suitable adult roles', () => {
    const result = voicePresentation({ ...voice, id: 'seventh-voice-luyao', name: '陆遥 · 雨灯' })
    expect(result.official).toBe(true)
    expect(result.example).toBe('陆遥')
    expect(result.roles).toContain('青年女性')
  })
  it('uses an audible voice name while preserving an author’s custom name', () => {
    expect(presentVoiceProfile(voice).name).toBe('晴音 · 清亮少女')
    expect(presentVoiceProfile({ ...voice, name: '林同学的声音' }).name).toBe('林同学的声音')
  })
  it('never presents Chinese audio as a Japanese audition', () => {
    expect(voiceLanguages(voice)).toEqual(['zh'])
    expect(voicePreviewUrl(voice, 'ja')).toBeUndefined()
    expect(voicePreviewUrl(voice, 'zh')).toBe('/zh.wav')
  })
  it('preserves an edited description and excludes withdrawn references', () => {
    expect(voicePresentation({ ...voice, description: '我修改后的音色说明' }).description).toBe('我修改后的音色说明')
    const revoked = { ...voice, references: [{ ...voice.references[0], language: 'ja', status: 'revoked' }] }
    expect(voiceLanguages(revoked)).toEqual(['zh'])
    expect(voicePreviewUrl(revoked, 'ja')).toBeUndefined()
  })
})
