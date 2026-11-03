import { mkdir, writeFile } from 'node:fs/promises'
import { PAINT_CHAPTER_ONE, PAINT_CHAPTER_ONE_LINES } from '../packages/story-domain/dist/index.js'
const dir = new URL('../docs/story/paint/', import.meta.url)
await mkdir(dir, { recursive: true })
const runtime = new URL('../.runtime/', import.meta.url)
await mkdir(runtime, { recursive: true })
await writeFile(new URL('paint-chapter1-script.json', runtime), JSON.stringify(PAINT_CHAPTER_ONE_LINES, null, 2) + '\n')
const { nodes, edges } = PAINT_CHAPTER_ONE.graph
const byId = new Map(nodes.map(n => [n.id, n]))
const write = (out, n, bilingual = false) => {
  if (n.type === 'subtitle') out.push(n.data.text, '')
  if (n.type === 'dialogue') out.push(`**${n.data.role}**：「${n.data.text}」`, '')
  if (bilingual && ['subtitle', 'dialogue'].includes(n.type)) out.push(`日文：${n.data.localizations.ja.text}`, '')
}
const reading = ['# 请让这幅画老去', '', `## ${PAINT_CHAPTER_ONE.chapterTitle}`, '', '正式可游玩第一章；承接序章当晚。本稿沿「先问杯子有没有换过」展开，另一个行动分支附在正文后。两条路共用杯子物证与章末，不以选择分配“正确结局”。', '']
let id = nodes[0].id, group = '', seen = new Set()
while (id && !seen.has(id)) {
  seen.add(id)
  const n = byId.get(id)
  if (!n) throw new Error(`Missing node ${id}`)
  if (n.data.sceneTitle !== group) { group = n.data.sceneTitle; reading.push(`### ${group}`, '') }
  write(reading, n)
  const outgoing = edges.filter(e => e.source === id)
  id = (n.type === 'choice' ? outgoing.find(e => e.sourceHandle === 'choice-0') : outgoing[0])?.target
}
reading.push('---', '', '### 另一个选择：先把自己的出游心意说完', '', '这段替换上文询问杯子的回应，之后同样确认杯口的变化。', '')
id = edges.find(e => e.source === 'pc1-ask-choice' && e.sourceHandle === 'choice-1').target
while (id !== 'pc1-cup-close-hide') { const n = byId.get(id); if (!n) throw new Error('Missing alternate'); write(reading, n); id = edges.find(e => e.source === id)?.target }
const source = '文学互文：Oscar Wilde, “The Artist”, *Poems in Prose*。[公版原文](https://www.gutenberg.org/files/774/774-h/774-h.htm)。本章只借旧像与新像的材料困境；炉前试排、送饭角色和全部对白均为原创，没有把吃饭宣称为对失去的答案。'
reading.push('---', '', source, '')
await writeFile(new URL('reading-chapter-one.zh.md', dir), reading.join('\n'))
const bilingual = ['# 第一章 · 今天也有一场坏戏：演出稿', '', '从正式图谱导出，包含两条分支；素材与音轨通过节点标识对应。', '']
group = ''
for (const n of nodes) {
  if (n.data.sceneTitle !== group) { group = n.data.sceneTitle; bilingual.push(`## ${group}`, '') }
  if (['subtitle', 'dialogue'].includes(n.type)) { bilingual.push(`### ${n.id}`, ''); write(bilingual, n, true) }
  if (n.type === 'choice') bilingual.push('**行动选择**', '', ...n.data.choices.map((s, i) => `${i + 1}. ${s}`), '')
}
bilingual.push(source, '')
await writeFile(new URL('01-chapter-one.md', dir), bilingual.join('\n'))
console.log(`Exported ${PAINT_CHAPTER_ONE_LINES.length} Japanese lines and both Chinese reading branches.`)
