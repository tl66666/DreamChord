import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { PAINT_PROLOGUE, PAINT_CHAPTER_ONE, PAINT_CHAPTER_TWO, PAINT_CHAPTER_TWO_LINES, PAINT_CHAPTER_TWO_SOURCES, PAINT_CHAPTER_THREE } from '../packages/story-domain/dist/index.js'
const root = new URL('../', import.meta.url), dir = new URL('docs/story/paint/', root)
await mkdir(dir, { recursive: true })
await mkdir(new URL('.runtime/', root), { recursive: true })
await writeFile(new URL('.runtime/paint-chapter2-script.json', root), JSON.stringify(PAINT_CHAPTER_TWO_LINES, null, 2) + '\n')
const { nodes, edges } = PAINT_CHAPTER_TWO.graph
const byId = new Map(nodes.map(n => [n.id, n]))
const write = (out, n, bilingual = false) => {
  if (n.type === 'subtitle') out.push(n.data.text, '')
  if (n.type === 'dialogue') out.push(`**${n.data.role}**：「${n.data.text}」`, '')
  if (bilingual && ['subtitle', 'dialogue'].includes(n.type)) out.push(`日文：${n.data.localizations.ja.text}`, '')
}
const reading = ['# 请让这幅画老去', '', `## ${PAINT_CHAPTER_TWO.chapterTitle}`, '', '本稿沿「先陪夏禾读一遍」展开；另一条行动分支附在正文后。选择改变陪伴的顺序，不决定夏禾应不应该去。游戏中的长旁白仍按短框阅读。', '']
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
reading.push('---', '', '### 另一个行动：先和许野调整排练', '', '替换正文先听夏禾读稿的片段，随后回到台前共同订下新的排练日。', '')
id = edges.find(e => e.source === 'pc2-support-choice' && e.sourceHandle === 'choice-1').target
while (id !== 'pc2-merge-xia') { const n = byId.get(id); if (!n) throw new Error('Missing alternate'); write(reading, n); id = edges.find(e => e.source === id)?.target }
const sources = PAINT_CHAPTER_TWO_SOURCES.map(s => `- ${s.author}《${s.title}》：[原文](${s.url})。${s.use}`)
reading.push('---', '', '### 文学互文', '', ...sources, '')
await writeFile(new URL('reading-chapter-two.zh.md', dir), reading.join('\n'))
const bilingual = ['# 第二章 · 她今天不想笑：演出稿', '', '从正式图谱导出。包含两个独有行动分支、共同试演准备和明确标示的画外片段。', '']
group = ''
for (const n of nodes) {
  if (n.data.sceneTitle !== group) { group = n.data.sceneTitle; bilingual.push(`## ${group}`, '') }
  if (['subtitle', 'dialogue'].includes(n.type)) { bilingual.push(`### ${n.id}`, ''); write(bilingual, n, true) }
  if (n.type === 'choice') bilingual.push('**行动选择**', '', ...n.data.choices.map((s, i) => `${i + 1}. ${s}`), '')
}
bilingual.push('## 文学互文', '', ...sources, '')
await writeFile(new URL('02-chapter-two.md', dir), bilingual.join('\n'))

const credits = JSON.parse(await readFile(new URL('apps/web/public/assets/audio/paint-book/music-credits.json', root), 'utf8'))
const legacy = JSON.parse(await readFile(new URL('apps/web/public/assets/audio/paint-prologue/music-credits.json', root), 'utf8'))
const all = [...credits, ...legacy]
const sheet = ['# 整书配乐节点表', '', '从四章正式图谱导出。按情境切换与复现主题，人物拒绝及实物核对保留停乐，不把音乐响起当作关系已经和解。', '', '| 章节 / 场景 | 节点 | 方向 | 原曲 / 作者 | 段内音量 |', '| --- | --- | --- | --- | --- |']
for (const chapter of [PAINT_PROLOGUE, PAINT_CHAPTER_ONE, PAINT_CHAPTER_TWO, PAINT_CHAPTER_THREE]) for (const node of chapter.graph.nodes) {
  const cue = node.data.audio?.bgm
  if (!cue) continue
  const credit = all.find(c => c.runtimeFile === cue.url)
  const title = credit ? `${credit.name} / ${credit.author}` : '—'
  sheet.push(`| ${chapter.chapterTitle} / ${node.data.sceneTitle} | ${node.id} | ${cue.action === 'stop' ? '停乐' : cue.action === 'keep' ? '保留当前曲，调整音量' : '进入主题'} | ${title} | ${cue.volume ?? '—'} |`)
}
sheet.push('', '段内音量还会乘播放器的背景音乐总音量；不是 LUFS。原名、来源、许可和处理记录见作品的 music-credits.json。未将技术解码或作者风格介绍当作人耳试听。', '')
await writeFile(new URL('MUSIC-CUE-SHEET.md', dir), sheet.join('\n'))
console.log(`Exported chapter two: ${PAINT_CHAPTER_TWO_LINES.length} Japanese lines, Chinese routes, bilingual manuscript and book cue sheet.`)
