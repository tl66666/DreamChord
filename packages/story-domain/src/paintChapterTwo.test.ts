import { describe, expect, it } from 'vitest'
import { PAINT_CHAPTER_TWO, PAINT_CHAPTER_TWO_LINES } from './paintChapterTwo.js'
import { PAINT_PROLOGUE } from './paintPrologue.js'
import { voiceTextHash } from './voiceDirection.js'

describe('chapter two: a decision made by Xia', () => {
  it('offers different support actions, rejoins, and carries her own decision through to a complete chapter', () => {
    const { nodes, edges } = PAINT_CHAPTER_TWO.graph
    expect(PAINT_CHAPTER_TWO.id).toBe(PAINT_PROLOGUE.id)
    expect(PAINT_CHAPTER_TWO.characters).toEqual(PAINT_PROLOGUE.characters)
    expect(new Set(nodes.map(n => n.id)).size).toBe(nodes.length)
    const reached = new Set<string>()
    const visit = (id: string) => { if (reached.has(id)) return; reached.add(id); edges.filter(e => e.source === id).forEach(e => visit(e.target)) }
    visit(nodes[0]!.id)
    expect(reached.size).toBe(nodes.length)
    expect(nodes.filter(n => !edges.some(e => e.source === n.id)).map(n => n.id)).toEqual(['pc2-ending'])
    expect(nodes.every(n => String(n.data.sceneCode).startsWith('3-'))).toBe(true)
    const choice = nodes.find(n => n.type === 'choice')!
    expect(choice.data.choices).toEqual(['先陪夏禾读一遍', '先和许野调整排练'])
    for (const handle of ['choice-0', 'choice-1']) {
      let id = edges.find(e => e.source === choice.id && e.sourceHandle === handle)!.target
      const route: string[] = []
      while (id) { route.push(id); id = edges.find(e => e.source === id)?.target || '' }
      expect(route).toContain('pc2-read-7')
      expect(route).toContain('pc2-paper-4')
      expect(route).toContain('pc2-end-3')
      expect(route.at(-1)).toBe('pc2-ending')
    }
  })
  it('keeps short bilingual dialogue, the established actor IDs, and silent narrative pages', () => {
    const spoken = PAINT_CHAPTER_TWO.graph.nodes.filter(n => n.type === 'dialogue')
    expect(spoken.map(n => n.id).sort()).toEqual(PAINT_CHAPTER_TWO_LINES.map(l => l.id).sort())
    for (const line of spoken) {
      const d = line.data as any
      expect(d.text.length).toBeLessThanOrEqual(40)
      expect(d.localizations.ja.sourceHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks.ja.textHash).toBe(voiceTextHash(d.localizations.ja.text))
      expect(d.voiceTracks.ja.profileId).toMatch(/^paint-voice-(cheng|xia|ye)$/)
      expect(d.voiceTracks.ja.url).toBe(`/assets/audio/paint-chapter-two/${line.id}-ja.ogg`)
    }
    for (const node of PAINT_CHAPTER_TWO.graph.nodes.filter(n => n.type === 'subtitle')) {
      const d = node.data as any
      expect(d.text.length, node.id).toBeLessThanOrEqual(125)
      expect(d.localizations.ja.text).toBeTruthy()
      expect(d.voiceTracks).toBeUndefined()
    }
  })
})
