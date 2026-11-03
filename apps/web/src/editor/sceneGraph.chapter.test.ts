import { describe, expect, it } from 'vitest'
import { normalizeChapterTitle } from './sceneGraph'

describe('authored chapter titles', () => {
  it('keeps prologue and named chapter subtitles independent of storage order', () => {
    expect(normalizeChapterTitle('序章 · 多出来的一把椅子', 0)).toBe('序章 · 多出来的一把椅子')
    expect(normalizeChapterTitle('第一章 · 今天也有一场坏戏', 1)).toBe('第一章 · 今天也有一场坏戏')
    expect(normalizeChapterTitle('六月六日', 1)).toBe('六月六日')
    expect(normalizeChapterTitle('第1章 · 6月6日', 1)).toBe('第一章 · 6月6日')
    expect(normalizeChapterTitle('', 1)).toBe('第二章')
  })
})
