import { mkdir, writeFile } from 'node:fs/promises'
import { PAINT_CHAPTER_THREE as chapter, PAINT_CHAPTER_THREE_LINES as lines, PAINT_CHAPTER_THREE_SOURCES as sources } from '../packages/story-domain/dist/index.js'
const root = new URL('../', import.meta.url), dir = new URL('docs/story/paint/', root)
await mkdir(dir, { recursive: true })
await mkdir(new URL('.runtime/', root), { recursive: true })
await writeFile(new URL('.runtime/paint-chapter3-script.json', root), JSON.stringify(lines, null, 2) + '\n')
const { nodes, edges } = chapter.graph, byId = new Map(nodes.map(n => [n.id, n]))
const write = (out, n, bilingual = false) => {
  if (n.type === 'subtitle') out.push(n.data.text, '')
  if (n.type === 'dialogue') out.push(`**${n.data.role}**：「${n.data.text}」`, '')
  if (bilingual && ['subtitle', 'dialogue'].includes(n.type)) out.push(`日文：${n.data.localizations.ja.text}`, '')
}
const reading = ['# 请让这幅画老去', '', `## ${chapter.chapterTitle}`, '', '本稿沿「先对照照片」展开；「先读手记」的独有片段附后。选择改变陆青查材料的起手顺序，两条路均阅读同一本手记，不替资料判定唯一真实。', '']
let id = nodes[0].id, group = ''
const seen = new Set()
while (id && !seen.has(id)) {
  seen.add(id)
  const n = byId.get(id)
  if (!n) throw Error('Missing node ' + id)
  if (n.data.sceneTitle !== group) { group = n.data.sceneTitle; reading.push(`### ${group}`, '') }
  write(reading, n)
  const outgoing = edges.filter(e => e.source === id)
  id = (n.type === 'choice' ? outgoing.find(e => e.sourceHandle === 'choice-0') : outgoing[0])?.target
}
reading.push('---', '', '### 另一个行动：先读手记', '', '替换正文陆青先对照照片的三个段落，随后同样进入六月三日的手记。', '')
id = edges.find(e => e.source === 'pc3-archive-choice' && e.sourceHandle === 'choice-1').target
while (id !== 'pc3-archive-order') { const n = byId.get(id); if (!n) throw Error('Missing alternate'); write(reading, n); id = edges.find(e => e.source === id)?.target }
const credits = sources.map(s => `- ${s.author}《${s.title}》：[原文](${s.url})。${s.use}`)
reading.push('---', '', '### 文学互文与资料边界', '', ...credits, '', '闻砚手记、照片题记与日期为原创虚构档案。手记里的海边经历另标为前一年八月十七日；资料可供查验，不保证免受改写。', '')
await writeFile(new URL('reading-chapter-three.zh.md', dir), reading.join('\n'))
const bilingual = [`# ${chapter.chapterTitle}：演出稿`, '', '从正式图谱导出，包含材料顺序两分支，过去手记与画外查验均明确标示。', '']
group = ''
for (const n of nodes) {
  if (n.data.sceneTitle !== group) { group = n.data.sceneTitle; bilingual.push(`## ${group}`, '') }
  if (['subtitle', 'dialogue'].includes(n.type)) { bilingual.push(`### ${n.id}`, ''); write(bilingual, n, true) }
  if (n.type === 'choice') bilingual.push('**行动选择**', '', ...n.data.choices.map((s, i) => `${i + 1}. ${s}`), '')
}
bilingual.push('## 文学互文', '', ...credits, '')
await writeFile(new URL('03-chapter-three.md', dir), bilingual.join('\n'))
console.log(`Exported chapter three: ${lines.length} Japanese lines and both manuscripts.`)
