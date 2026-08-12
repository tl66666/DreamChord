import { describe, expect, it } from 'vitest'
import { buildCreativeBrief } from './creativeBrief.js'

const snapshot = {
  projectId: 'project', title: '雾港来信', description: '', bible: null,
  characters: [{ id: 'snow', name: '雪', description: '寻找来信的人' }],
  assets: [
    { id: 'harbor', name: '夜晚港口', type: 'BACKGROUND', url: '/uploads/harbor.png', width: 1920, height: 1080 },
    { id: 'snow-sprite', name: '雪立绘', type: 'CG', url: '/uploads/snow.png', width: 900, height: 1600 },
  ],
  chapters: [],
}

describe('CreativeBrief', () => {
  it('derives reusable material and missing requirements from the original creative request', () => {
    const brief = buildCreativeBrief({ text: '续写夜晚港口的重逢，雪在雨中等林宇出现，需要一张关键 CG。', snapshot })

    expect(brief.materials.reused).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'BACKGROUND', name: '夜晚港口' }),
      expect.objectContaining({ type: 'CHARACTER', name: '雪' }),
    ]))
    expect(brief.materials.missing).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'CHARACTER', name: '林宇' }),
      expect.objectContaining({ type: 'CG' }),
    ]))
  })

  it('does not substitute unrelated project material for an unmatched request', () => {
    const brief = buildCreativeBrief({ text: '在废弃车站让林晚独自发现信件。', snapshot })

    expect(brief.materials.reused.some((material) => material.name === '夜晚港口')).toBe(false)
    expect(brief.materials.reused.some((material) => material.name === '雪')).toBe(false)
    expect(brief.materials.missing).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'BACKGROUND', name: '废弃车站' }),
      expect.objectContaining({ type: 'CHARACTER', name: '林晚' }),
    ]))
  })
})
