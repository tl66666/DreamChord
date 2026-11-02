import { describe, expect, it } from 'vitest'
import { SEVENTH_ROW_DEMO } from './seventhRowDemo.js'
import { voiceTextHash } from './voiceDirection.js'

describe('第七排，空座 official demo', () => {
  it('uses narration cards so prose never inherits the previous speaker in the editor', () => {
    const prose = SEVENTH_ROW_DEMO.graph.nodes.filter(n => n.data.role === '旁白')
    expect(prose.length).toBeGreaterThan(10)
    expect(prose.every(n => n.type === 'subtitle')).toBe(true)
  })
  it('has exactly two reachable endings and no broken branch destinations', () => {
    const { nodes, edges } = SEVENTH_ROW_DEMO.graph
    const ids = new Set(nodes.map(n => n.id))
    const reached = new Set<string>()
    const visit = (id: string) => { if (reached.has(id)) return; reached.add(id); edges.filter(e => e.source === id).forEach(e => visit(e.target)) }
    visit(nodes[0]!.id)
    expect(reached.size).toBe(nodes.length)
    expect(edges.every(e => ids.has(e.source) && ids.has(e.target))).toBe(true)
    expect(nodes.filter(n => !edges.some(e => e.source === n.id)).map(n => n.id).sort()).toEqual(['ending-live', 'ending-original'])
    const choice = nodes.find(n => n.type === 'choice')!
    expect(edges.filter(e => e.source === choice.id).map(e => e.sourceHandle).sort()).toEqual(['choice-0', 'choice-1'])
  })
  it('ships matched bilingual audio for every spoken line including both endings', () => {
    const lines = SEVENTH_ROW_DEMO.graph.nodes.filter(n => n.type === 'dialogue' && n.data.role !== '旁白')
    expect(lines.length).toBeGreaterThanOrEqual(30)
    for (const line of lines) {
      const d = line.data as { text: string; role: string; localizations: { ja: { text: string; sourceHash: string } }; voiceTracks: Record<string, { url: string; textHash: string; profileId: string }> }
      expect(SEVENTH_ROW_DEMO.characters.some(c => c.name === d.role)).toBe(true)
      expect(d.localizations.ja.sourceHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks.zh!.textHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks.ja!.textHash).toBe(voiceTextHash(d.localizations.ja.text))
      expect(d.voiceTracks.ja!.url).toContain(`${line.id}-ja.ogg`)
      expect(d.voiceTracks.zh!.profileId).toBe(d.voiceTracks.ja!.profileId)
    }
  })
})
