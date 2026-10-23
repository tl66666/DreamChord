import { describe, expect, it } from 'vitest'
import { getStageSpritePresentation } from './stagePresentation'

describe('getStageSpritePresentation', () => {
  it('uses a close bust composition for human characters during formal play', () => {
    expect(getStageSpritePresentation({
      mode: 'stage',
      position: 'center',
      totalCharacters: 1,
      isSystem: false,
      isSpeaker: true,
    })).toMatchObject({
      framing: 'bust',
      anchorPercent: 50,
      widthPercent: 52,
      brightness: 1,
      scale: 1.02,
    })
  })

  it('keeps system characters fully visible on the same stage', () => {
    const result = getStageSpritePresentation({
      mode: 'stage',
      position: 'right',
      totalCharacters: 2,
      isSystem: true,
      isSpeaker: false,
    })

    expect(result.framing).toBe('full')
    expect(result.anchorPercent).toBe(76)
    expect(result.objectFit).toBe('contain')
  })

  it('spreads two and three character compositions predictably', () => {
    const leftPair = getStageSpritePresentation({ mode: 'stage', position: 'left', totalCharacters: 2, isSystem: false, isSpeaker: true })
    const rightPair = getStageSpritePresentation({ mode: 'stage', position: 'right', totalCharacters: 2, isSystem: false, isSpeaker: true })
    const centerTrio = getStageSpritePresentation({ mode: 'stage', position: 'center', totalCharacters: 3, isSystem: false, isSpeaker: true })

    expect([leftPair.anchorPercent, rightPair.anchorPercent]).toEqual([27, 73])
    expect(centerTrio.anchorPercent).toBe(50)
    expect(centerTrio.widthPercent).toBeLessThan(leftPair.widthPercent)
  })

  it('dims a non-speaker without making them disappear', () => {
    const result = getStageSpritePresentation({
      mode: 'stage',
      position: 'left',
      totalCharacters: 2,
      isSystem: false,
      isSpeaker: false,
    })

    expect(result.brightness).toBeGreaterThanOrEqual(0.62)
    expect(result.brightness).toBeLessThan(1)
    expect(result.saturation).toBeLessThan(1)
    expect(result.opacity).toBe(1)
  })

  it('supports explicit full and bust inspection modes', () => {
    expect(getStageSpritePresentation({ mode: 'full', position: 'center', totalCharacters: 1, isSystem: false, isSpeaker: true }).framing).toBe('full')
    expect(getStageSpritePresentation({ mode: 'bust', position: 'center', totalCharacters: 1, isSystem: false, isSpeaker: true }).framing).toBe('bust')
  })
})
