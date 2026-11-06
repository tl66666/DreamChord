import { describe, expect, it } from 'vitest'
import { applyPaintScore, PAINT_SCORE } from './paintScore.js'
import { PAINT_PROLOGUE } from './paintPrologue.js'
import { PAINT_CHAPTER_ONE } from './paintChapterOne.js'
import { PAINT_CHAPTER_TWO } from './paintChapterTwo.js'
import type { StoryNode } from './types.js'

describe('the book scene score', () => {
  it('retains effects and voice metadata while applying play, keep and stop directions', () => {
    const nodes: StoryNode[] = ['start', 'hold', 'end'].map(id => ({ id, type: 'subtitle', position: { x: 0, y: 0 }, data: { text: id, audio: { sfx: [{ url: '/paper.ogg' }] }, voiceTracks: { ja: { url: '/voice.ogg' } } } }))
    applyPaintScore(nodes, [{ nodeId: 'start', track: 'tam-ame', volume: .4 }, { nodeId: 'hold', keep: true, volume: .3 }, { nodeId: 'end', stop: true }])
    expect(nodes[0].data.audio).toMatchObject({ sfx: [{ url: '/paper.ogg' }], bgm: { action: 'play', url: PAINT_SCORE['tam-ame'], volume: .4 } })
    expect(nodes[1].data.audio).toMatchObject({ bgm: { action: 'keep', volume: .3 } })
    expect(nodes[2].data.audio).toMatchObject({ bgm: { action: 'stop' } })
    expect(nodes[0].data.voiceTracks).toEqual({ ja: { url: '/voice.ogg' } })
    expect(() => applyPaintScore(nodes, [{ nodeId: 'absent', stop: true }])).toThrow('Missing scored story beat')
  })
  it('uses all eight credited cues and leaves conflicts/evidence without music', () => {
    const nodes = [PAINT_PROLOGUE, PAINT_CHAPTER_ONE, PAINT_CHAPTER_TWO].flatMap(c => c.graph.nodes)
    const audio = (id: string) => nodes.find(n => n.id === id)!.data.audio as { bgm: { action: string; url?: string } }
    const urls = nodes.map(n => (n.data.audio as { bgm?: { url?: string } } | undefined)?.bgm?.url).filter(Boolean)
    expect(new Set(urls)).toEqual(new Set(Object.values(PAINT_SCORE)))
    for (const id of ['pc1-cup-evidence', 'pc2-hall-paper', 'pc2-read-own-fear', 'pc2-corridor-clock', 'pc2-outside-cut']) expect(audio(id).bgm.action, id).toBe('stop')
  })
})
