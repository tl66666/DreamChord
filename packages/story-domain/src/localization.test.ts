import { describe, expect, it } from 'vitest'
import { resolveLocalizedContent } from './localization.js'
import { voiceTextHash } from './voiceDirection.js'

describe('localized dialogue and independent voice tracks', () => {
  const content = { text: '谢谢。', role: 'yuki', choices: ['留下', '离开'], originalVoice: { url: '/zh.wav' }, localizations: { ja: { text: 'ありがとう。', choices: ['残る', '立ち去る'] } } }
  it('switches text while preserving choice order and the original object', () => {
    const result = resolveLocalizedContent(content, 'ja', 'zh')
    expect(result).toMatchObject({ text: 'ありがとう。', choices: ['残る', '立ち去る'], voice: { url: '/zh.wav' }, fallback: false })
    expect(content.text).toBe('谢谢。')
  })
  it('never plays Chinese audio as a substitute for a missing Japanese track', () => {
    expect(resolveLocalizedContent(content, 'zh', 'ja')).toMatchObject({ text: '谢谢。', voice: undefined, missingVoice: true })
  })
  it('falls back for incomplete choices without changing branch indexes', () => {
    const result = resolveLocalizedContent({ ...content, localizations: { ja: { choices: ['残る'] } } }, 'ja', 'ja')
    expect(result.choices).toEqual(['留下', '离开'])
    expect(result.fallback).toBe(true)
  })
  it('mutes a voice take whose own language text has changed', () => {
    const voiceTracks = { ja: { url: '/ja.wav', textHash: voiceTextHash('違う台詞。') } }
    expect(resolveLocalizedContent({ ...content, voiceTracks }, 'zh', 'ja')).toMatchObject({ staleVoice: true, voice: undefined })
  })
  it('displays Chinese while playing a Japanese track', () => {
    expect(resolveLocalizedContent({ ...content, voiceTracks: { ja: { url: '/ja.wav', textHash: voiceTextHash('ありがとう。') } } }, 'zh', 'ja')).toMatchObject({ text: '谢谢。', choices: ['留下', '离开'], voice: { url: '/ja.wav' }, fallback: false })
  })
  it('does not replay an old translation after only the Chinese source changes', () => {
    const outdated = { ...content, text: '请别走。', localizations: { ja: { text: 'ありがとう。', sourceHash: voiceTextHash('谢谢。') } }, voiceTracks: { ja: { url: '/ja.wav', textHash: voiceTextHash('ありがとう。') } } }
    expect(resolveLocalizedContent(outdated, 'ja', 'ja')).toMatchObject({ text: '请别走。', staleVoice: true, voice: undefined, fallback: true })
  })
})
