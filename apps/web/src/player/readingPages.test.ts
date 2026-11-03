import { describe, expect, it } from 'vitest'
import { splitReadingPages } from './readingPages'
import { PAINT_PROLOGUE, PAINT_CHAPTER_ONE } from '@dreamchord/story-domain'

describe('short visual novel reading pages', () => {
  it('keeps short dialogue intact and splits long prose at natural breaks without losing text', () => {
    expect(splitReadingPages('灯我拿。你站稳一点。')).toEqual(['灯我拿。你站稳一点。'])
    const text = '铜像由一捆卷好的旧布充当。许野说，先别考虑好看不好看，抱住试试。\n布比我以为的轻。我试了三个姿势，最后把一端抵在胸口，另一端托起来。\n姿势有点像抱一个睡着的孩子。发现这一点后，我没敢再换。'
    const pages = splitReadingPages(text)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''))
    expect(pages.every(p => Array.from(p).length <= 66)).toBe(true)
    expect(pages.every(p => !/^[，。！？」』”]/.test(p))).toBe(true)
    expect(pages[0]).toContain('抱住试试。')
  })
  it('retains quotation attribution when brief and keeps Japanese punctuation and Unicode intact', () => {
    const quote = '“可是，真正的幸福究竟是什么呢？”\n\n宫泽贤治《银河铁道之夜》\n据日文原文自译'
    expect(splitReadingPages(quote)).toEqual([quote])
    const ja = '紙には、そう書いてある。その通り読んでも、手は元の場所に残った。\n客席のイエは、僕が歩き出すのを待っている。描いただけの炉を見ても、どちらの手から放せばいいのか分からなかった。\n戸を叩くはずのホーも、まだ叩かない。'
    expect(splitReadingPages(ja).join('').replace(/\s/g, '')).toBe(ja.replace(/\s/g, ''))
    expect(splitReadingPages('😀'.repeat(150)).every(p => !p.includes('\uFFFD') && Array.from(p).length <= 66)).toBe(true)
  })
  it('keeps every Chinese and Japanese narration page within the reading budget across both chapters', () => {
    for (const node of [...PAINT_PROLOGUE.graph.nodes, ...PAINT_CHAPTER_ONE.graph.nodes].filter(n => n.type === 'subtitle')) {
      const texts = [node.data.text, (node.data.localizations as { ja: { text: string } }).ja.text] as string[]
      for (const text of texts) {
        const pages = splitReadingPages(text)
        expect(pages.every(p => Array.from(p).length <= 66), node.id).toBe(true)
        expect(pages.join('').replace(/\s/g, ''), node.id).toBe(text.replace(/\s/g, ''))
      }
    }
  })
})
