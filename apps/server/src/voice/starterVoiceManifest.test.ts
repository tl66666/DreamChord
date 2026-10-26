import { describe, expect, it } from 'vitest'
import { parseStarterVoiceManifest, starterVoiceKeys } from './starterVoiceManifest.js'

const voice = {
  id: 'dreamchord-xingli', name: '星璃・清澈', description: '清亮自然', language: 'zh-CN', ageTone: '少女', genderTone: '女声',
  tags: ['合成音色'], sourceVoiceId: 'zf_xiaobei', transcript: '这是一段用于测试的中文参考台词。',
  outputFile: 'generated/dreamchord-xingli.wav', sha256: 'a'.repeat(64), durationSeconds: 9.5,
}

const manifest = {
  schemaVersion: 1, packId: 'dreamchord-starter', displayName: '梦弦起始音色', sourceModel: 'hexgrad/Kokoro-82M',
  sourceUrl: 'https://huggingface.co/hexgrad/Kokoro-82M', sourceLicense: 'Apache-2.0', syntheticSource: true,
  generatedAt: '2026-10-26T00:00:00Z', voices: [voice],
}

describe('starter voice manifest', () => {
  it('accepts traceable licensed synthetic voices and generates stable database keys', () => {
    const parsed = parseStarterVoiceManifest(manifest)
    expect(parsed.voices[0].id).toBe('dreamchord-xingli')
    expect(starterVoiceKeys(parsed.voices[0])).toEqual({
      assetId: 'starter-voice-asset-dreamchord-xingli',
      profileId: 'starter-voice-profile-dreamchord-xingli',
      referenceId: 'starter-voice-reference-dreamchord-xingli',
    })
    expect(starterVoiceKeys(parsed.voices[0])).toEqual(starterVoiceKeys(parsed.voices[0]))
  })

  it('rejects real-person or ambiguously licensed starter packs', () => {
    expect(() => parseStarterVoiceManifest({ ...manifest, syntheticSource: false })).toThrow(/synthetic/i)
    expect(() => parseStarterVoiceManifest({ ...manifest, sourceLicense: 'unknown' })).toThrow(/Apache-2.0/)
  })

  it('rejects unsafe audio paths and incomplete hashes', () => {
    expect(() => parseStarterVoiceManifest({ ...manifest, voices: [{ ...voice, outputFile: '../../voice.wav' }] })).toThrow(/generated/)
    expect(() => parseStarterVoiceManifest({ ...manifest, voices: [{ ...voice, sha256: null }] })).toThrow()
  })
})
