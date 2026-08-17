export interface LongImportChunkPlan { index: number; chapterTitle: string; text: string; startOffset: number; endOffset: number }

const CHAPTER_HEADING = /^(?:#{1,6}\s+.+|chapter\s+\d+.*|第[一二三四五六七八九十百千0-9]+[章节回].*)$/im

function splitOversizedSection(text: string, chapterTitle: string, startOffset: number, chunkSize: number, indexStart: number): LongImportChunkPlan[] {
  if (text.length <= chunkSize) return [{ index: indexStart, chapterTitle, text, startOffset, endOffset: startOffset + text.length }]
  const chunks: LongImportChunkPlan[] = []
  let cursor = 0
  while (cursor < text.length) {
    let end = Math.min(text.length, cursor + chunkSize)
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('。', end), text.lastIndexOf('！', end), text.lastIndexOf('？', end))
      if (boundary > cursor + Math.floor(chunkSize * 0.5)) end = boundary + 1
    }
    const part = text.slice(cursor, end).trim()
    if (part) chunks.push({ index: indexStart + chunks.length, chapterTitle, text: part, startOffset: startOffset + cursor, endOffset: startOffset + end })
    cursor = end
  }
  return chunks
}

export function splitLongImportText(source: string, chunkSize = 12_000): LongImportChunkPlan[] {
  const text = source.replace(/\r\n?/g, '\n').trim()
  if (!text) return []
  const matches = [...text.matchAll(new RegExp(CHAPTER_HEADING.source, 'gim'))]
  const boundaries = matches.length > 0 ? matches.map((match) => ({ title: match[0].replace(/^#+\s*/, '').trim(), start: match.index ?? 0 })) : [{ title: '未命名章节', start: 0 }]
  const chunks: LongImportChunkPlan[] = []
  boundaries.forEach((boundary, index) => {
    const end = boundaries[index + 1]?.start ?? text.length
    chunks.push(...splitOversizedSection(text.slice(boundary.start, end).trim(), boundary.title, boundary.start, chunkSize, chunks.length))
  })
  return chunks
}

export function calculateImportProgress(chunks: Array<{ status: string }>): { total: number; completed: number; failed: number; percent: number } {
  const total = chunks.length
  const completed = chunks.filter((chunk) => chunk.status === 'completed').length
  const failed = chunks.filter((chunk) => chunk.status === 'failed').length
  return { total, completed, failed, percent: total === 0 ? 0 : Math.floor((completed / total) * 100) }
}
