import { describe, expect, it } from 'vitest'
import { buildCharacterVoicePlan } from './voicePlan.js'
import type { AgentProjectSnapshot } from './context.js'

const snapshot: AgentProjectSnapshot = {
  projectId: 'project',
  title: '回声档案',
  description: '',
  bible: {
    worldSummary: '', themes: [], styleGuide: '', timelineRules: '', forbiddenElements: [],
    characterNotes: { snow: { goal: '', secret: '', voice: '克制、轻声，句末留白', relations: '' } },
  },
  characters: [
    { id: 'snow', name: '雪', description: '调查员', voiceProfile: JSON.stringify({ style: '清冷但不疏离', pace: 'slow', defaultEmotion: '克制', sampleAssetIds: ['snow-sample'], consentConfirmed: true }) },
    { id: 'ren', name: '凛', description: '同伴', voiceProfile: '{}' },
  ],
  assets: [
    { id: 'snow-sample', name: '雪-授权样本', type: 'VOICE_SAMPLE', url: '/uploads/snow.mp3', width: null, height: null, metadata: JSON.stringify({ voiceSample: { characterId: 'snow', consentConfirmed: true, style: '近距离、低声' } }) },
    { id: 'ren-sample', name: '凛-授权样本', type: 'VOICE_SAMPLE', url: '/uploads/ren.mp3', width: null, height: null, metadata: JSON.stringify({ voiceSample: { characterId: 'ren', consentConfirmed: true } }) },
  ],
  chapters: [{ id: 'chapter', title: '第一章', version: 1, graph: {
    nodes: [
      { id: 'narration', type: 'subtitle', position: { x: 0, y: 0 }, data: { text: '雨停了。', sceneGroupId: 'scene-1' } },
      { id: 'snow-line', type: 'dialogue', position: { x: 0, y: 100 }, data: { role: '雪', text: '别回头，门还开着。', sceneGroupId: 'scene-1' } },
      { id: 'ren-line', type: 'dialogue', position: { x: 0, y: 200 }, data: { role: '凛', text: '我听见里面有人。', sceneGroupId: 'scene-1' } },
    ], edges: [],
  } }],
}

describe('buildCharacterVoicePlan', () => {
  it('plans only the selected character dialogue with that character authorised samples', () => {
    const plan = buildCharacterVoicePlan({ snapshot, characterId: 'snow', chapterId: 'chapter', sceneGroupId: 'scene-1' })

    expect(plan.character).toMatchObject({ id: 'snow', name: '雪', consentConfirmed: true })
    expect(plan.samples).toEqual([expect.objectContaining({ assetId: 'snow-sample', consentConfirmed: true })])
    expect(plan.lines).toEqual([expect.objectContaining({ nodeId: 'snow-line', text: '别回头，门还开着。', speaker: '雪', emotion: '克制', pace: 'slow' })])
    expect(plan.provider).toEqual(expect.objectContaining({ configured: false }))
    expect(JSON.stringify(plan)).not.toContain('ren-sample')
  })

  it('reports a missing authorised sample without borrowing another character voice', () => {
    const withoutSnowSample: AgentProjectSnapshot = { ...snapshot, assets: snapshot.assets.filter((asset) => asset.id !== 'snow-sample') }
    const plan = buildCharacterVoicePlan({ snapshot: withoutSnowSample, characterId: 'snow', chapterId: 'chapter' })

    expect(plan.samples).toEqual([])
    expect(plan.warnings.join('\n')).toContain('授权声音样本')
    expect(plan.nextActions.join('\n')).toContain('上传')
  })
})
