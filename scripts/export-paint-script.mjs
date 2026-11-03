import { mkdir, writeFile } from 'node:fs/promises'
import { PAINT_LINES, PAINT_PROLOGUE, PAINT_LITERARY_SOURCES } from '../packages/story-domain/dist/index.js'
const dir = new URL('../.runtime/', import.meta.url)
await mkdir(dir, { recursive: true })
await writeFile(new URL('paint-script.json', dir), JSON.stringify(PAINT_LINES, null, 2) + '\n')
console.log(`Exported ${PAINT_LINES.length} authored lines for resumable voice generation.`)
if (process.argv.includes('--docs')) {
  const sections = ['# 《请让这幅画老去》序章定稿', '', '本文件由 `node scripts/export-paint-script.mjs --docs` 从正式图谱导出。包含两个行动分支；它们在开场排练结束后汇合。后续正式章节尚未发布。', '']
  let group = ''
  for (const n of PAINT_PROLOGUE.graph.nodes) {
    if (n.data.sceneGroupId !== group) { group = n.data.sceneGroupId; sections.push(`## ${n.data.sceneTitle}`, '') }
    if (n.type === 'dialogue' || n.type === 'subtitle') sections.push(`**${n.data.role}** · ${n.id}`, '', n.data.text, '', `日文：${n.data.localizations.ja.text}`, '')
    if (n.type === 'choice') sections.push('**行动选择（分支各有独有回应，然后汇合）**', '', ...n.data.choices.map((v, i) => `${i + 1}. ${v}`), '')
  }
  const storyDir = new URL('../docs/story/paint/', import.meta.url)
  sections.push('## 互文来源', '', ...PAINT_LITERARY_SOURCES.map(s => `- ${s.author}《${s.title}》：[原文](${s.url})。${s.use}`), '')
  await mkdir(storyDir, { recursive: true })
  await writeFile(new URL('00-prologue.md', storyDir), sections.join('\n').trimEnd() + '\n')
}
if (process.argv.includes('--reading')) {
  const { nodes, edges } = PAINT_PROLOGUE.graph
  const byId = new Map(nodes.map(n => [n.id, n]))
  const parts = ['# 请让这幅画老去', '', '## 序章 · 多出来的一把椅子', '', '本阅读稿沿「陪许野对台词」的选择展开；另一段行动分支附在正文后。文字与游戏当前版本一致。', '']
  let id = nodes[0].id, section = '', seen = new Set()
  const write = n => {
    if (n.type === 'subtitle') parts.push(n.data.text, '')
    if (n.type === 'dialogue') parts.push(`**${n.data.role}**：「${n.data.text}」`, '')
  }
  while (id && !seen.has(id)) {
    seen.add(id)
    const n = byId.get(id)
    if (!n) throw new Error(`Missing reading node: ${id}`)
    if (n.data.sceneTitle !== section) { section = n.data.sceneTitle; parts.push(`### ${section}`, '') }
    write(n)
    const next = edges.filter(e => e.source === id)
    id = n.type === 'choice' ? next.find(e => e.sourceHandle === 'choice-0')?.target : next[0]?.target
  }
  const alternate = edges.find(e => e.source === 'p-action-choice' && e.sourceHandle === 'choice-1')
  if (alternate) {
    parts.push('---', '', '### 另一个选择：留下来帮夏禾整理道具', '', '这段替换正文中的对台词片段，之后同样回到胶干后的排练。', '')
    id = alternate.target; seen = new Set()
    while (id && id !== 'p-before-stage' && !seen.has(id)) {
      seen.add(id); const n = byId.get(id)
      if (!n) throw new Error(`Missing alternate node: ${id}`)
      write(n); id = edges.find(e => e.source === id)?.target
    }
  }
  parts.push('---', '', '### 文学互文来源', '', ...PAINT_LITERARY_SOURCES.map(s => `- ${s.author}《${s.title}》：[原文](${s.url})。${s.use}`))
  const dir = new URL('../docs/story/paint/', import.meta.url)
  await mkdir(dir, { recursive: true })
  await writeFile(new URL('reading.zh.md', dir), parts.join('\n').trimEnd() + '\n')
}
