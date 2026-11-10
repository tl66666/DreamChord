import { describe, expect, it } from 'vitest'
import { PAINT_PROLOGUE } from './paintPrologue.js'
import { PAINT_SCORE } from './paintScore.js'
import { voiceTextHash } from './voiceDirection.js'
import { PAINT_CHAPTER_FOUR, PAINT_CHAPTER_FOUR_LINES } from './paintChapterFour.js'

async function chapter() {
  return { PAINT_CHAPTER_FOUR, PAINT_CHAPTER_FOUR_LINES }
}

describe('chapter four: another pair of hands', () => {
  it('preserves the original cast and appends only the two independently acting townspeople', async () => {
    const { PAINT_CHAPTER_FOUR: book } = await chapter()
    expect(book.characters.slice(0, 4)).toEqual(PAINT_PROLOGUE.characters)
    expect(book.characters.map(c => c.slug)).toEqual(['cheng', 'xia', 'ye', 'lu', 'liu', 'shen'])
    expect(book.characters.slice(4).map(c => c.defaultSprite)).toEqual(['/assets/paint-world/liu-jian-stage.webp', '/assets/paint-world/shen-yun-stage.webp'])
    for (const role of ['刘济安', '沈芸']) {
      expect(book.graph.nodes.some(n => n.type === 'character' && n.data.characterId === role && n.data.action === 'show')).toBe(true)
      expect(book.graph.nodes.filter(n => n.type === 'dialogue' && n.data.role === role)).toHaveLength(4)
    }
  })

  it('offers two materially different rehearsal actions with one reachable shared ending', async () => {
    const { PAINT_CHAPTER_FOUR: { graph: { nodes, edges } } } = await chapter()
    expect(new Set(nodes.map(n => n.id)).size).toBe(nodes.length)
    expect(new Set(nodes.map(n => n.data.sceneGroupId)).size).toBe(6)
    expect(nodes.every(n => n.id.startsWith('pc4-') && String(n.data.sceneCode).startsWith('5-'))).toBe(true)
    const reached = new Set<string>()
    const visit = (id: string) => { if (reached.has(id)) return; reached.add(id); edges.filter(e => e.source === id).forEach(e => visit(e.target)) }
    visit(nodes[0]!.id)
    expect(reached.size).toBe(nodes.length)
    expect(nodes.filter(n => !edges.some(e => e.source === n.id)).map(n => n.id)).toEqual(['pc4-ending'])
    const choice = nodes.filter(n => n.type === 'choice')
    expect(choice).toHaveLength(1)
    expect(choice[0]!.data.choices).toEqual(['扶稳送饭的小桌', '替许野读一轮对手词'])
    const paths = ['choice-0', 'choice-1'].map(handle => {
      let id = edges.find(e => e.source === choice[0]!.id && e.sourceHandle === handle)!.target
      const path: string[] = []
      while (id) { expect(path).not.toContain(id); path.push(id); id = edges.find(e => e.source === id)?.target || '' }
      return path
    })
    for (const path of paths) { expect(path).toContain('pc4-rehearsal-merge'); expect(path.at(-1)).toBe('pc4-ending') }
    expect(paths[0]!.filter(id => !paths[1]!.includes(id)).length).toBeGreaterThanOrEqual(4)
    expect(paths[1]!.filter(id => !paths[0]!.includes(id)).length).toBeGreaterThanOrEqual(4)
  })

  it('keeps short bilingual voiced lines, silent prose and existing licensed score cues', async () => {
    const { PAINT_CHAPTER_FOUR: book, PAINT_CHAPTER_FOUR_LINES: lines } = await chapter()
    const spoken = book.graph.nodes.filter(n => n.type === 'dialogue')
    expect(spoken.length).toBeGreaterThanOrEqual(25)
    expect(spoken.length).toBeLessThanOrEqual(40)
    expect(spoken.map(n => n.id).sort()).toEqual(lines.map(l => l.id).sort())
    for (const node of spoken) {
      const d = node.data as any
      expect(d.text.length, node.id).toBeLessThanOrEqual(36)
      expect(d.localizations.ja.sourceHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks.ja.textHash).toBe(voiceTextHash(d.localizations.ja.text))
      expect(d.voiceTracks.ja.profileId).toMatch(/^paint-voice-(cheng|xia|ye|lu|liu|shen)$/)
      expect(d.voiceTracks.ja.url).toBe(`/assets/audio/paint-chapter-four/${node.id}-ja.ogg`)
    }
    const narrative = book.graph.nodes.filter(n => n.type === 'subtitle')
    for (const node of narrative) {
      const d = node.data as any
      expect(d.text.length, node.id).toBeLessThanOrEqual(85)
      expect(d.localizations.ja.text, node.id).toBeTruthy()
      expect(d.localizations.ja.sourceHash).toBe(voiceTextHash(d.text))
      expect(d.voiceTracks).toBeUndefined()
    }
    const han = narrative.map(n => n.data.text).join('').match(/\p{Script=Han}/gu)?.length || 0
    expect(han).toBeGreaterThanOrEqual(2500)
    expect(han).toBeLessThanOrEqual(4000)
    for (const node of book.graph.nodes) {
      const audio = node.data.audio as any
      if (audio?.bgm?.action === 'play') expect(Object.values(PAINT_SCORE)).toContain(audio.bgm.url)
      if (['刘济安', '沈芸'].includes(String(node.data.characterId))) expect(node.data.expression).toBe('normal')
    }
  })

  it('carries forward dates, waiting, the unsafe chair and incomplete commission without a new supernatural answer', async () => {
    const { PAINT_CHAPTER_FOUR: book } = await chapter()
    const text = book.graph.nodes.map(n => n.data.text || '').join('\n')
    for (const fact of ['四月二十日', '两点五十五分', '三点', '一周内回信', '六月六日', '第二班车', '空白明信片', '复查', '别动', '核对原稿，续作', '面部', '暂缓']) expect(text).toContain(fact)
    expect(text).not.toMatch(/陆青听见.{0,8}(夏禾|程见|礼堂)|资料.{0,4}不会.{0,4}改写|已经录取|母亲复活/)
    expect(book.graph.nodes.filter(n => n.type === 'background').map(n => n.data.backgroundId).every(id => ['/assets/paint-chapter-four/commission-desk.webp', '/assets/paint-chapter-four/hall-afternoon.webp'].includes(String(id)))).toBe(true)
  })
})
