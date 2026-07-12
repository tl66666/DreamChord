import type { LensType } from './sceneGraph'

export interface ParsedCard {
  kind: 'dialogue' | 'narration'
  text: string
  speaker?: string
  lensType: LensType
  line: number
}
export interface ManuscriptPreview {
  chapters: Array<{ title: string; scenes: Array<{ title: string; cards: ParsedCard[] }> }>
  warnings: Array<{ line: number; message: string }>
}

function splitLong(line: string): string[] {
  if (line.length <= 90 || /^([^：:\n]{1,24})[：:]/.test(line)) return [line]
  const sentences = line.match(/[^。！？!?；;]+[。！？!?；;]?/g) ?? [line]
  const result: string[] = []
  let buffer = ''
  for (const sentence of sentences) {
    if (buffer && (buffer + sentence).length > 90) { result.push(buffer); buffer = sentence }
    else buffer += sentence
  }
  if (buffer) result.push(buffer)
  return result
}

function markedNarration(raw: string): { text: string; lensType: LensType } {
  const marker = raw.match(/^\s*[【[]\s*(回忆|心理|心声|系统|提示|旁白)\s*[】]]\s*/)
  const text = marker ? raw.slice(marker[0].length).trim() : raw.trim()
  if (marker?.[1] === '回忆') return { text, lensType: 'memory' }
  if (marker && ['心理', '心声'].includes(marker[1] ?? '')) return { text, lensType: 'thought' }
  if (marker && ['系统', '提示'].includes(marker[1] ?? '')) return { text, lensType: 'system' }
  if (/回忆|想起|那年|曾经|梦里|过去/.test(text)) return { text, lensType: 'memory' }
  if (/心想|心里|暗想|她想|他想|我想/.test(text)) return { text, lensType: 'thought' }
  if (/系统|提示|警告|权限|错误/.test(text)) return { text, lensType: 'system' }
  return { text, lensType: 'narration' }
}

export function parseManuscript(text: string, knownSpeakers: string[] = []): ManuscriptPreview {
  const warnings: ManuscriptPreview['warnings'] = []
  const chapters: ManuscriptPreview['chapters'] = []
  const speakerSet = new Set(knownSpeakers.map((name) => name.trim()).filter(Boolean))

  const ensureChapter = () => chapters.at(-1) ?? (chapters.push({ title: '未命名章节', scenes: [] }), chapters[0]!)
  const ensureScene = () => {
    const chapter = ensureChapter()
    return chapter.scenes.at(-1) ?? (chapter.scenes.push({ title: `场景 ${chapter.scenes.length + 1}`, cards: [] }), chapter.scenes[0]!)
  }

  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (!line) return
    if (/^(第[^\s]{1,12}章(?:\s+.*)?|chapter\s+\d+.*)$/i.test(line)) { chapters.push({ title: line.replace(/^#+\s*/, ''), scenes: [] }); return }
    const sceneHeading = line.match(/^(?:#{1,4}\s*)?场景\s*[：:]?\s*(.*)$/)
    if (sceneHeading || /^(-{3,}|\*{3,})$/.test(line)) {
      const chapter = ensureChapter(); chapter.scenes.push({ title: sceneHeading?.[1]?.trim() || `场景 ${chapter.scenes.length + 1}`, cards: [] }); return
    }
    const dialogue = line.match(/^([^：:\n]{1,24})[：:]\s*(.+)$/)
    if (dialogue) {
      const speaker = dialogue[1]!.trim()
      if (speakerSet.size > 0 && !speakerSet.has(speaker)) warnings.push({ line: index + 1, message: `未找到角色「${speaker}」，导入后请重新指定` })
      ensureScene().cards.push({ kind: 'dialogue', speaker, text: dialogue[2]!.trim(), lensType: 'dialogue', line: index + 1 })
      return
    }
    for (const part of splitLong(line)) {
      const narration = markedNarration(part)
      if (narration.text) ensureScene().cards.push({ kind: 'narration', ...narration, line: index + 1 })
    }
  })

  if (chapters.length === 0 || chapters.every((chapter) => chapter.scenes.every((scene) => scene.cards.length === 0))) {
    warnings.push({ line: 0, message: '没有识别到可导入的正文' })
  }
  return { chapters, warnings }
}
