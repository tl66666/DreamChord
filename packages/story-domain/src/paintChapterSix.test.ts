import { describe, expect, it } from 'vitest'
import { voiceTextHash } from './voiceDirection.js'
import { PAINT_CHAPTER_SIX } from './paintChapterSix.js'

describe('sixth chapter: asking before answering', () => {
  it('gives each choice its own consequence before a common ending', () => {
    const { nodes, edges } = PAINT_CHAPTER_SIX.graph
    const choice = nodes.find(node => node.type === 'choice')!
    const paths = [0, 1].map(index => {
      let id = edges.find(edge => edge.source === choice.id && edge.sourceHandle === `choice-${index}`)?.target
      const visited: string[] = []
      while (id) { expect(visited).not.toContain(id); visited.push(id); id = edges.find(edge => edge.source === id)?.target }
      return visited
    })
    expect(paths[0]).toContain('pc6-schedule-consequence')
    expect(paths[1]).toContain('pc6-question-consequence')
    expect(paths[0]).not.toContain('pc6-question-consequence')
    expect(paths[1]).not.toContain('pc6-schedule-consequence')
    expect(paths.map(path => path.at(-1))).toEqual(['pc6-ending', 'pc6-ending'])
  })
  it('keeps the Japanese text and voice fingerprints in sync', () => {
    const lines = PAINT_CHAPTER_SIX.graph.nodes.filter(node => node.type === 'dialogue')
    expect(lines.length).toBeGreaterThanOrEqual(18)
    for (const line of lines) {
      const data = line.data as any
      expect(data.localizations.ja.sourceHash).toBe(voiceTextHash(data.text))
      expect(data.voiceTracks.ja.textHash).toBe(voiceTextHash(data.localizations.ja.text))
      expect(data.voiceTracks.ja.url).toBe(`/assets/audio/paint-chapter-six/${line.id}-ja.ogg`)
    }
  })
})
