import { describe, expect, it } from 'vitest'
import { PAINT_CHAPTER_ONE, PAINT_CHAPTER_ONE_LINES } from './paintChapterOne.js'
import { PAINT_PROLOGUE } from './paintPrologue.js'
import { voiceTextHash } from './voiceDirection.js'

describe('first chapter as a continuation of the same book', () => {
  it('has reachable branches, shared evidence and one terminal', () => {
    const { nodes, edges } = PAINT_CHAPTER_ONE.graph
    const reached = new Set<string>()
    const visit = (id: string) => { if (reached.has(id)) return; reached.add(id); edges.filter(e => e.source === id).forEach(e => visit(e.target)) }
    visit(nodes[0]!.id)
    expect(reached.size).toBe(nodes.length)
    expect(new Set(nodes.map(n => n.id)).size).toBe(nodes.length)
    expect(nodes.filter(n => !edges.some(e => e.source === n.id)).map(n => n.id)).toEqual(['pc1-ending'])
    const choice = nodes.find(n => n.type === 'choice')!
    expect(edges.filter(e => e.source === choice.id).map(e => e.sourceHandle).sort()).toEqual(['choice-0', 'choice-1'])
    for (const handle of ['choice-0', 'choice-1']) {
      let id = edges.find(e => e.source === choice.id && e.sourceHandle === handle)!.target
      const route: string[] = []
      while (id) { route.push(id); id = edges.find(e => e.source === id)?.target ?? '' }
      expect(route).toContain('pc1-cup-evidence')
      expect(route.at(-1)).toBe('pc1-ending')
    }
    expect(PAINT_CHAPTER_ONE.id).toBe(PAINT_PROLOGUE.id)
    expect(PAINT_CHAPTER_ONE.characters).toEqual(PAINT_PROLOGUE.characters)
    expect(nodes.every(n => String(n.data.sceneCode).startsWith('2-'))).toBe(true)
  })
  it('carries current Japanese dialogue with the established voices and silent bilingual prose', () => {
    const spoken = PAINT_CHAPTER_ONE.graph.nodes.filter(n => n.type === 'dialogue')
    expect(spoken.map(n => n.id).sort()).toEqual(PAINT_CHAPTER_ONE_LINES.map(n => n.id).sort())
    for (const n of spoken) {
      const d = n.data as any
      expect(d.localizations.ja.sourceHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks.ja.textHash).toBe(voiceTextHash(d.localizations.ja.text))
      expect(d.voiceTracks.ja.url).toBe(`/assets/audio/paint-chapter-one/${n.id}-ja.ogg`)
      expect(d.voiceTracks.ja.profileId).toMatch(/^paint-voice-(cheng|xia|ye)$/)
    }
    const prose = PAINT_CHAPTER_ONE.graph.nodes.filter(n => n.type === 'subtitle')
    for (const n of prose) {
      const d = n.data as any
      expect(d.voiceTracks).toBeUndefined()
      expect(d.text.length).toBeLessThanOrEqual(125)
      expect(d.localizations.ja.text.length).toBeGreaterThan(0)
    }
  })
})
