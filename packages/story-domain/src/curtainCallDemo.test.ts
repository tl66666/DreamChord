import { describe, expect, it } from 'vitest'
import { CURTAIN_CALL_DEMO, CURTAIN_STARTER_ENDING } from './curtainCallDemo.js'
import { voiceTextHash } from './voiceDirection.js'

describe('curtain call creator demo', () => {
  it('uses audible music cue levels before player mixing and speech ducking', () => {
    const cues = [...CURTAIN_CALL_DEMO.graph.nodes, CURTAIN_STARTER_ENDING].map(node => node.data.audio as { bgm?: { action: string; volume?: number } } | undefined).filter(audio => audio?.bgm?.action === 'play')
    expect(cues).toHaveLength(5)
    expect(cues.every(audio => audio!.bgm!.volume! >= .4 && audio!.bgm!.volume! <= .6)).toBe(true)
  })
  it('has two complete reachable routes, while the third ending belongs only to the creator starter', () => {
    const { nodes, edges } = CURTAIN_CALL_DEMO.graph
    const reached = new Set<string>()
    const visit = (id: string) => { if (reached.has(id)) return; reached.add(id); edges.filter(e => e.source === id).forEach(e => visit(e.target)) }
    visit(nodes[0]!.id)
    expect(reached.size).toBe(nodes.length)
    expect(nodes.filter(n => !edges.some(e => e.source === n.id)).map(n => n.id).sort()).toEqual(['ending-invitation', 'ending-station'])
    expect(edges.every(e => reached.has(e.source) && reached.has(e.target))).toBe(true)
    expect(nodes.some(n => n.id === CURTAIN_STARTER_ENDING.id)).toBe(false)
    expect(nodes.filter(n => n.type === 'choice')).toHaveLength(1)
  })
  it('has current bilingual recordings for each character line and keeps narration silent', () => {
    expect(CURTAIN_STARTER_ENDING.data.audio).toMatchObject({ bgm: { action: 'play', url: '/assets/audio/curtain-call/backstage.ogg' } })
    const lines = [...CURTAIN_CALL_DEMO.graph.nodes.filter(n => n.type === 'dialogue'), CURTAIN_STARTER_ENDING]
    expect(lines.length).toBeGreaterThanOrEqual(30)
    for (const node of lines) {
      const d = node.data as { text: string; role: string; localizations: { ja: { text: string; sourceHash: string } }; voiceTracks: Record<string, { url: string; textHash: string }> }
      expect(CURTAIN_CALL_DEMO.characters.some(c => c.name === d.role)).toBe(true)
      expect(d.localizations.ja.sourceHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks.zh!.textHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks.ja!.textHash).toBe(voiceTextHash(d.localizations.ja.text))
      expect(d.voiceTracks.ja!.url).toContain(`${node.id}-ja.ogg`)
    }
    expect(CURTAIN_CALL_DEMO.graph.nodes.filter(n => n.data.role === '旁白').every(n => n.type === 'subtitle')).toBe(true)
  })
})
