import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { voiceTextHash } from '@dreamchord/story-domain'
import type { VoiceProfile } from '../api/client'
import { planCharacterVoices } from './characterVoicePlan'
const profiles = [{ id: 'voice', status: 'active', bindings: [{ project: { id: 'project' }, character: { id: 'character-yuki', name: '雪' } }], references: [{ id: 'zh', status: 'active', language: 'zh' }, { id: 'ja', status: 'active', language: 'ja' }] }] as VoiceProfile[]
const node = (data: Record<string, unknown>): Node => ({ id: 'line', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: 'yuki', text: '别走。', ...data } })
describe('character voice planning', () => {
  it('uses a character binding for every new line without selecting an audio asset', () => {
    const result = planCharacterVoices([node({})], profiles, 'project', 'ja')
    expect(result.pending[0]).toMatchObject({ characterId: 'character-yuki', profileId: 'voice', referenceId: 'ja', sourceText: '别走。' })
    expect(result.pending[0].spokenText).toBeUndefined()
  })
  it('keeps matching recorded audio and regenerates changed dialogue', () => {
    expect(planCharacterVoices([node({ voiceTracks: { zh: { url: '/old.wav', textHash: voiceTextHash('别走。') } } })], profiles, 'project', 'zh').ready).toBe(1)
    expect(planCharacterVoices([node({ text: '请留下。', voiceTracks: { zh: { url: '/old.wav', textHash: voiceTextHash('别走。') } } })], profiles, 'project', 'zh').pending).toHaveLength(1)
  })
  it('does not use a stale translation or another project’s role binding', () => {
    const data = node({ localizations: { ja: { text: '行かないで。', sourceHash: voiceTextHash('旧台词') } } })
    expect(planCharacterVoices([data], profiles, 'project', 'ja').pending[0].spokenText).toBeUndefined()
    expect(planCharacterVoices([data], profiles, 'other-project', 'ja').unbound).toBe(1)
  })
  it('regenerates a take from a previously bound voice and supports explicit rerecording', () => {
    const old = node({ voiceTracks: { zh: { url: '/old.wav', profileId: 'previous-voice', textHash: voiceTextHash('别走。') } } })
    expect(planCharacterVoices([old], profiles, 'project', 'zh').pending).toHaveLength(1)
    const same = node({ voiceTracks: { zh: { url: '/old.wav', profileId: 'voice', textHash: voiceTextHash('别走。') } } })
    expect(planCharacterVoices([same], profiles, 'project', 'zh', true).pending).toHaveLength(1)
  })
})
