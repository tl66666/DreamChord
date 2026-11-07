import { describe, expect, it } from 'vitest'
import { PAINT_CHAPTER_THREE, PAINT_CHAPTER_THREE_LINES, PAINT_CHAPTER_THREE_SOURCES } from './paintChapterThree.js'
import { PAINT_PROLOGUE } from './paintPrologue.js'
import { PAINT_SCORE } from './paintScore.js'
import { voiceTextHash } from './voiceDirection.js'

describe('chapter three: the summer outside the painting', () => {
  it('keeps the two archive actions distinct and rejoins before the same ending', () => {
    const { nodes, edges } = PAINT_CHAPTER_THREE.graph
    expect(PAINT_CHAPTER_THREE.id).toBe(PAINT_PROLOGUE.id)
    expect(PAINT_CHAPTER_THREE.characters).toEqual(PAINT_PROLOGUE.characters)
    expect(new Set(nodes.map(n => n.id)).size).toBe(nodes.length)
    expect(nodes.every(n => n.id.startsWith('pc3-') && String(n.data.sceneCode).startsWith('4-'))).toBe(true)
    const reached = new Set<string>()
    const visit = (id: string) => { if (reached.has(id)) return; reached.add(id); edges.filter(e => e.source === id).forEach(e => visit(e.target)) }
    visit(nodes[0]!.id)
    expect(reached.size).toBe(nodes.length)
    expect(nodes.filter(n => !edges.some(e => e.source === n.id)).map(n => n.id)).toEqual(['pc3-ending'])
    const choices = nodes.filter(n => n.type === 'choice')
    expect(choices).toHaveLength(1)
    expect(choices[0]!.data.choices).toEqual(['先对照照片', '先读手记'])
    const routes = ['choice-0', 'choice-1'].map(handle => {
      let id = edges.find(e => e.source === choices[0]!.id && e.sourceHandle === handle)!.target
      const route: string[] = []
      while (id) { route.push(id); id = edges.find(e => e.source === id)?.target || '' }
      return route
    })
    for (const route of routes) {
      expect(route).toContain('pc3-archive-order')
      expect(route).toContain('pc3-source-record')
      expect(route.at(-1)).toBe('pc3-ending')
    }
    expect(routes[0]!.filter(id => !routes[1]!.includes(id))).toHaveLength(3)
    expect(routes[1]!.filter(id => !routes[0]!.includes(id))).toHaveLength(3)
  })

  it('provides short bilingual dialogue with stable voices and silent, readable narrative', () => {
    const spoken = PAINT_CHAPTER_THREE.graph.nodes.filter(n => n.type === 'dialogue')
    expect(spoken).toHaveLength(30)
    expect(spoken.map(n => n.id).sort()).toEqual(PAINT_CHAPTER_THREE_LINES.map(l => l.id).sort())
    for (const node of spoken) {
      const d = node.data as any
      expect(d.text.length, node.id).toBeLessThanOrEqual(36)
      expect(d.localizations.ja.sourceHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks.ja.textHash).toBe(voiceTextHash(d.localizations.ja.text))
      expect(d.voiceTracks.ja.profileId).toMatch(/^paint-voice-(cheng|xia|ye)$/)
      expect(d.voiceTracks.ja.url).toBe(`/assets/audio/paint-chapter-three/${node.id}-ja.ogg`)
    }
    const narrative = PAINT_CHAPTER_THREE.graph.nodes.filter(n => n.type === 'subtitle')
    for (const node of narrative) {
      const d = node.data as any
      expect(d.text.length, node.id).toBeLessThanOrEqual(125)
      expect(d.localizations.ja.text, node.id).toBeTruthy()
      expect(d.localizations.ja.sourceHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks).toBeUndefined()
    }
    const han = narrative.map(n => n.data.text).join('').match(/\p{Script=Han}/gu)?.length || 0
    expect(han).toBeGreaterThanOrEqual(2500)
    expect(han).toBeLessThanOrEqual(3300)
  })

  it('attributes the short quotation and preserves paper sound when scoring the source record', () => {
    expect(PAINT_CHAPTER_THREE_SOURCES).toHaveLength(1)
    expect(PAINT_CHAPTER_THREE_SOURCES[0]!.nodeId).toBe('pc3-july-reading')
    const { nodes } = PAINT_CHAPTER_THREE.graph
    const record = nodes.find(n => n.id === 'pc3-source-record')!.data as any
    expect(record.audio.bgm.action).toBe('stop')
    expect(record.audio.sfx[0].url).toBe('/assets/audio/paint-prologue/paper.ogg')
    for (const node of nodes) {
      const audio = node.data.audio as any
      if (audio?.bgm?.action === 'play') expect(Object.values(PAINT_SCORE)).toContain(audio.bgm.url)
    }
    const text = nodes.filter(n => n.type === 'subtitle').map(n => n.data.text).join('\n')
    expect(text).toContain('原作者选择未完成')
    expect(text).toContain('画层损坏')
    expect(text).toContain('闻砚手记')
  })
})
