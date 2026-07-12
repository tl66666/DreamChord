import { describe, expect, it } from 'vitest'
import { parseManuscript } from './manuscriptParser'

describe('manuscript parser', () => {
  it('recognizes chapters, scenes, dialogue, markers, and unknown speakers', () => {
    const preview = parseManuscript(`第一章 冬夜\n场景：车站\n雪：你听见了吗？\n陌生人：别回头。\n[回忆] 她想起十年前的雪。\n---\n[系统] 门已锁定。`, ['雪'])
    expect(preview.chapters[0]?.title).toContain('第一章')
    expect(preview.chapters[0]?.scenes).toHaveLength(2)
    expect(preview.chapters[0]?.scenes[0]?.cards[0]).toMatchObject({ kind: 'dialogue', speaker: '雪' })
    expect(preview.chapters[0]?.scenes[0]?.cards.at(-1)).toMatchObject({ lensType: 'memory' })
    expect(preview.chapters[0]?.scenes[1]?.cards[0]).toMatchObject({ lensType: 'system' })
    expect(preview.warnings.some((warning) => warning.message.includes('陌生人'))).toBe(true)
  })

  it('splits long narration and reports empty input', () => {
    const long = '雪沿着没有尽头的站台向前走。'.repeat(20)
    expect(parseManuscript(long).chapters[0]?.scenes[0]?.cards.length).toBeGreaterThan(1)
    expect(parseManuscript('   ').warnings[0]?.message).toContain('正文')
  })
})
