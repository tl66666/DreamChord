import type { StoryNode } from '@dreamchord/story-domain'
import type { AgentProjectSnapshot } from './context.js'

export interface CharacterVoicePlan {
  character: { id: string; name: string; voiceStyle: string; consentConfirmed: boolean }
  samples: Array<{ assetId: string; name: string; url: string; consentConfirmed: boolean; style: string }>
  provider: { configured: false; reason: string }
  lines: Array<{ nodeId: string; text: string; speaker: string; emotion: string; pace: string; pauseHint: string; delivery: string }>
  warnings: string[]
  nextActions: string[]
}

type VoiceProfile = { style?: string; pace?: string; defaultEmotion?: string; sampleAssetIds?: string[]; consentConfirmed?: boolean }
type VoiceSampleMetadata = { voiceSample?: { characterId?: string; consentConfirmed?: boolean; style?: string } }

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function dialogueLines(nodes: StoryNode[], character: { id: string; name: string }, emotion: string, pace: string, style: string) {
  return nodes.flatMap((node) => {
    if (node.type !== 'dialogue') return []
    const role = typeof node.data.role === 'string' ? node.data.role : ''
    const text = typeof node.data.text === 'string' ? node.data.text.trim() : ''
    if (!text || (role !== character.id && role !== character.name)) return []
    return [{
      nodeId: node.id, text, speaker: character.name, emotion, pace,
      pauseHint: /[，、]/.test(text) ? '逗号处停顿 0.2 秒，句末停顿 0.4 秒' : '句末停顿 0.4 秒',
      delivery: style || '保持角色当前的叙事语气，清晰表达信息重点',
    }]
  })
}

export function buildCharacterVoicePlan(input: { snapshot: AgentProjectSnapshot; characterId: string; chapterId?: string; sceneGroupId?: string }): CharacterVoicePlan {
  const character = input.snapshot.characters.find((item) => item.id === input.characterId || item.name === input.characterId)
  if (!character) throw new Error('角色不存在或不属于当前项目')
  const profile = parseJson<VoiceProfile>(character.voiceProfile, {})
  const chapter = input.snapshot.chapters.find((item) => item.id === input.chapterId) ?? input.snapshot.chapters[0]
  const scopedNodes = chapter ? input.sceneGroupId ? chapter.graph.nodes.filter((node) => node.data.sceneGroupId === input.sceneGroupId) : chapter.graph.nodes : []
  const samples = input.snapshot.assets.flatMap((asset) => {
    if (asset.type !== 'VOICE_SAMPLE') return []
    const sample = parseJson<VoiceSampleMetadata>(asset.metadata, {}).voiceSample
    if (sample?.characterId !== character.id || sample.consentConfirmed !== true) return []
    if (profile.sampleAssetIds?.length && !profile.sampleAssetIds.includes(asset.id)) return []
    return [{ assetId: asset.id, name: asset.name, url: asset.url, consentConfirmed: true, style: sample.style ?? '' }]
  })
  const emotion = profile.defaultEmotion || '自然'
  const pace = profile.pace || 'normal'
  const voiceStyle = profile.style || samples[0]?.style || input.snapshot.bible?.characterNotes[character.id]?.voice || ''
  const lines = dialogueLines(scopedNodes, character, emotion, pace, voiceStyle)
  const warnings: string[] = []
  const nextActions: string[] = []
  if (samples.length === 0) {
    warnings.push('该角色缺少授权声音样本，不能提交克隆或声线生成请求。')
    nextActions.push('在编辑器素材库上传该角色的 30-90 秒清晰声音样本，并确认拥有使用与克隆授权。')
  }
  if (lines.length === 0) {
    warnings.push('所选范围内没有该角色的可配音台词。')
    nextActions.push('先在工作台添加或选择该角色的对白镜头卡，再重新生成配音计划。')
  }
  nextActions.push('配置语音 Provider 后，以本计划逐句生成候选 VOICE 素材；试听并确认后再绑定到镜头卡。')
  return {
    character: { id: character.id, name: character.name, voiceStyle, consentConfirmed: samples.length > 0 },
    samples,
    provider: { configured: false, reason: '当前未配置语音生成 Provider；DreamChord 只提供脚本和审核链路，不会伪造音频。' },
    lines, warnings, nextActions,
  }
}
