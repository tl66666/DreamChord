import { describe, expect, it } from 'vitest'
import { applyStageToShotCard, type ShotCard } from './sceneGraph'

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
})
