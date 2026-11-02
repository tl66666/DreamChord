import { mkdir, writeFile } from 'node:fs/promises'
import { PAINT_LINES, PAINT_PROLOGUE } from '../packages/story-domain/dist/index.js'
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
  await mkdir(storyDir, { recursive: true })
  await writeFile(new URL('00-prologue.md', storyDir), sections.join('\n').trimEnd() + '\n')
}
