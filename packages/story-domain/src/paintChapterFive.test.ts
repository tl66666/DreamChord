import { describe, expect, it } from 'vitest'
import { voiceTextHash } from './voiceDirection.js'
import { PAINT_CHAPTER_FIVE } from './paintChapterFive.js'

describe('chapter five: letter and commission', () => {
  it('keeps both choices distinct until their next-day consequences and reaches one ending', () => {
    const { nodes, edges } = PAINT_CHAPTER_FIVE.graph
    const choice = nodes.find(n => n.type === 'choice')!
    expect(choice.data.choices).toEqual(['留下来陪许野排练', '去河边找夏禾'])
    const paths = [0, 1].map(index => {
      let id = edges.find(e => e.source === choice.id && e.sourceHandle === `choice-${index}`)?.target
      const ids: string[] = []
      while (id) { expect(ids).not.toContain(id); ids.push(id); id = edges.find(e => e.source === id)?.target }
      return ids
    })
    expect(paths[0]).toContain('pc5-paper-consequence')
    expect(paths[1]).toContain('pc5-card-consequence')
    expect(paths[0]).not.toContain('pc5-card-consequence')
    expect(paths[1]).not.toContain('pc5-paper-consequence')
    expect(paths[0].at(-1)).toBe('pc5-ending')
    expect(paths[1].at(-1)).toBe('pc5-ending')
  })
  it('has bilingual short-form dialogue with matching Japanese tracks', () => {
    const lines = PAINT_CHAPTER_FIVE.graph.nodes.filter(n => n.type === 'dialogue')
    expect(lines.length).toBeGreaterThanOrEqual(18)
    for (const node of lines) {
      const data = node.data as any
      expect(data.localizations.ja.sourceHash).toBe(voiceTextHash(data.text))
      expect(data.voiceTracks.ja.textHash).toBe(voiceTextHash(data.localizations.ja.text))
      expect(data.voiceTracks.ja.url).toBe(`/assets/audio/paint-chapter-five/${node.id}-ja.ogg`)
    }
  })
})
