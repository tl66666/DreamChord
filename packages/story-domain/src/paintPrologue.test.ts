import { describe, expect, it } from 'vitest'
import { PAINT_PROLOGUE, PAINT_STARTER_CARD } from './paintPrologue.js'
import { PAINT_LINES } from './paintLines.js'
import { voiceTextHash } from './voiceDirection.js'

describe('paint prologue canon and performance', () => {
  it('has reachable action branches that rejoin, and one complete ending', () => {
    const { nodes, edges } = PAINT_PROLOGUE.graph
    const reached = new Set<string>()
    const visit = (id: string) => { if (reached.has(id)) return; reached.add(id); edges.filter(e => e.source === id).forEach(e => visit(e.target)) }
    visit(nodes[0]!.id)
    expect(reached.size).toBe(nodes.length)
    expect(nodes.filter(n => !edges.some(e => e.source === n.id)).map(n => n.id)).toEqual(['p-ending'])
    const choice = nodes.find(n => n.type === 'choice')!
    expect(edges.filter(e => e.source === choice.id).map(e => e.sourceHandle).sort()).toEqual(['choice-0', 'choice-1'])
    expect(edges.filter(e => e.target === 'p-before-stage')).toHaveLength(2)
    expect(nodes.some(n => n.id === PAINT_STARTER_CARD.id)).toBe(false)
  })
  it('keeps every authored line, current Japanese tracks and silent Chinese narration', () => {
    const spoken = [...PAINT_PROLOGUE.graph.nodes, PAINT_STARTER_CARD].filter(n => n.type === 'dialogue')
    expect(spoken.map(n => n.id).sort()).toEqual(PAINT_LINES.map(n => n.id).sort())
    for (const node of spoken) {
      const d = node.data as { text: string; role: string; localizations: { ja: { text: string; sourceHash: string } }; voiceTracks: Record<string, { url: string; textHash: string; profileId: string }> }
      expect(PAINT_PROLOGUE.characters.some(c => c.name === d.role)).toBe(true)
      expect(d.localizations.ja.sourceHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks.ja!.textHash).toBe(voiceTextHash(d.localizations.ja.text))
      expect(d.voiceTracks.ja!.url).toBe(`/assets/audio/paint-prologue/${node.id}-ja.ogg`)
      expect(d.voiceTracks.zh).toBeUndefined()
    }
    expect(PAINT_PROLOGUE.graph.nodes.filter(n => n.data.role === '旁白').every(n => n.type === 'subtitle' && !n.data.voiceTracks)).toBe(true)
  })
  it('plants one physical clue before showing its erasure and the outside record', () => {
    const ids = PAINT_PROLOGUE.graph.nodes.map(n => n.id)
    expect(ids.indexOf('p-repaired-detail')).toBeLessThan(ids.indexOf('p-erased-detail'))
    expect(ids.indexOf('p-erased-detail')).toBeLessThan(ids.indexOf('p-outside-1'))
    const d = PAINT_PROLOGUE.graph.nodes.find(n => n.id === 'p-empty-patch')!.data
    expect(d.text).toContain('左后腿')
    expect(d.audio).toMatchObject({ bgm: { action: 'stop' } })
  })
})
