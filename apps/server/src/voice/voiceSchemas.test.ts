import { describe, expect, it } from 'vitest'
import {
  attachVoiceReferenceSchema,
  createVoiceGenerationSchema,
  createVoiceProfileSchema,
  updateVoiceProfileSchema,
} from './voiceSchemas.js'

describe('voice library schemas', () => {
  it('requires a reusable profile name and affirmative authorization', () => {
    expect(createVoiceProfileSchema.safeParse({ name: '雪·轻声', language: 'zh', authorizationConfirmed: true }).success).toBe(true)
    expect(createVoiceProfileSchema.safeParse({ name: '雪·轻声', language: 'zh', authorizationConfirmed: false }).success).toBe(false)
    expect(createVoiceProfileSchema.safeParse({ name: '', language: 'zh', authorizationConfirmed: true }).success).toBe(false)
  })

  it('requires an exact transcript and language for each reference clip', () => {
    expect(attachVoiceReferenceSchema.safeParse({ assetId: 'asset', transcript: '请听清这句话。', language: 'zh', authorizationConfirmed: true }).success).toBe(true)
    expect(attachVoiceReferenceSchema.safeParse({ assetId: 'asset', transcript: '', language: 'zh', authorizationConfirmed: true }).success).toBe(false)
    expect(attachVoiceReferenceSchema.safeParse({ assetId: 'asset', transcript: 'test', language: '', authorizationConfirmed: true }).success).toBe(false)
  })

  it('bounds generation controls and never accepts a provider URL from the browser', () => {
    expect(createVoiceGenerationSchema.safeParse({ projectId: 'project', characterId: 'character', referenceId: 'reference', text: '你好', language: 'zh', speed: 1 }).success).toBe(true)
    expect(createVoiceGenerationSchema.safeParse({ projectId: 'project', characterId: 'character', referenceId: 'reference', text: '你好', language: 'zh', speed: 2.5 }).success).toBe(false)
    expect(createVoiceGenerationSchema.safeParse({ projectId: 'project', characterId: 'character', referenceId: 'reference', text: '你好', language: 'zh', speed: 1, baseUrl: 'http://evil.test' }).success).toBe(false)
  })

  it('allows profile revocation without allowing authorization to be forged through updates', () => {
    expect(updateVoiceProfileSchema.safeParse({ status: 'revoked' }).success).toBe(true)
    expect(updateVoiceProfileSchema.safeParse({ authorizationConfirmed: true }).success).toBe(false)
  })
})
