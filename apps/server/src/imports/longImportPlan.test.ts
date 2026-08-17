import { describe, expect, it } from 'vitest'
import { calculateImportProgress, splitLongImportText } from './longImportPlan.js'

describe('long import plan', () => {
  it('keeps chapter headings with their chunks and preserves source order', () => {
    const chunks = splitLongImportText('第一章 雨夜\n甲乙丙丁\n第二章 车站\n戊己庚辛', 20)
    expect(chunks.map((chunk) => chunk.chapterTitle)).toEqual(['第一章 雨夜', '第二章 车站'])
    expect(chunks.map((chunk) => chunk.text)).toEqual(['第一章 雨夜\n甲乙丙丁', '第二章 车站\n戊己庚辛'])
  })

  it('reports durable chunk progress without counting failed work as complete', () => {
    expect(calculateImportProgress([{ status: 'completed' }, { status: 'running' }, { status: 'failed' }, { status: 'queued' }])).toEqual({ total: 4, completed: 1, failed: 1, percent: 25 })
  })
})
