import { describe, expect, it } from 'vitest'
import { applyAudioAssetToShotCard, applyStageToShotCard, createSceneNodes, draftFromSceneNodes, type ShotCard } from './sceneGraph'

const card: ShotCard = {
  id: 'line', sceneId: 'scene', sceneGroupId: 'scene', sceneCode: '1-1', nodeIds: ['line'],
  type: 'dialogue', lensType: 'dialogue', background: '/old.png', speaker: 'ren',
  speakerExpression: 'serious', speakerPosition: 'right', autoStageSpeaker: true, text: '我来了。',
  characters: [{ characterId: 'ren', expression: 'serious', position: 'right', action: 'show' }],
}

describe('shot-card effective stage', () => {
  it('shows inherited characters together with a newly arriving character', () => {
    const result = applyStageToShotCard(card, {
      backgroundId: '/room.png',
      characters: [
        { characterId: 'yuki', expression: 'normal', position: 'left', action: 'keep' },
        { characterId: 'ren', expression: 'serious', position: 'right', action: 'keep' },
      ],
    })

    expect(result.background).toBe('/room.png')
    expect(result.characters).toEqual([
      { characterId: 'yuki', expression: 'normal', position: 'left', action: 'keep' },
      { characterId: 'ren', expression: 'serious', position: 'right', action: 'show' },
    ])
  })

  it('keeps an explicit leave event visible after the character leaves the effective stage', () => {
    const result = applyStageToShotCard({
      ...card,
      characters: [{ characterId: 'yuki', expression: 'normal', position: 'left', action: 'hide' }],
    }, { backgroundId: '/room.png', characters: [] })

    expect(result.characters).toEqual([
      { characterId: 'yuki', expression: 'normal', position: 'left', action: 'hide' },
    ])
  })

  it('round-trips structured audio direction through the playable text node', () => {
    const audio = {
      bgm: { action: 'play' as const, url: '/uploads/rain.mp3', volume: 0.45, fadeInMs: 600 },
      sfx: [{ url: '/uploads/thunder.ogg', volume: 0.8 }],
      voice: { url: '/uploads/narration.wav', volume: 0.9 },
    }

    const { nodes } = createSceneNodes({ ...card, audio }, 'scene')
    const textNode = nodes.find((node) => node.type === 'dialogue')

    expect(textNode?.data.audio).toEqual(audio)
    expect(draftFromSceneNodes(nodes).audio).toEqual(audio)
  })

  it('adds a selected audio asset without discarding other channel directions', () => {
    const withBgm = applyAudioAssetToShotCard(card, 'bgm', '/uploads/rain.mp3')
    const withEffect = applyAudioAssetToShotCard(withBgm, 'sfx', '/uploads/thunder.ogg')
    const withSecondEffect = applyAudioAssetToShotCard(withEffect, 'sfx', '/uploads/chime.ogg')
    const withVoice = applyAudioAssetToShotCard(withSecondEffect, 'voice', '/uploads/narration.wav')

    expect(withVoice.audio).toEqual({
      bgm: { action: 'play', url: '/uploads/rain.mp3' },
      sfx: [{ url: '/uploads/thunder.ogg' }, { url: '/uploads/chime.ogg' }],
      voice: { url: '/uploads/narration.wav' },
    })
  })
})
