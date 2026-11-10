/** Construct a Chinese, unvoiced review graph from the authored chapter draft. */
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export function makePreviewGraph(markdown) {
  const part = (start, end) => {
    const from = markdown.indexOf(start)
    const to = markdown.indexOf(end, from + start.length)
    if (from < 0 || to < 0) throw new Error(`Missing draft section: ${start}`)
    return markdown.slice(from + start.length, to).trim()
  }
  const before = [part('### 画外 · 回执', '### 街口 · 等一封信'), part('### 街口 · 等一封信', '### 傍晚 · 一页和一封信'), part('### 傍晚 · 一页和一封信', '**选择：**')]
  const routes = [part('### 路线一 · 空下来的位置', '### 路线二 · 河边的一面'), part('### 路线二 · 河边的一面', '### 次日 · 回信的人')]
  const next = part('### 次日 · 回信的人', '### 画外 · 等待确认')
  const a = next.indexOf('**带着稿来：**'), b = next.indexOf('**带着明信片来：**'), common = next.indexOf('共同场景里')
  if (!(a >= 0 && b > a && common > b)) throw new Error('Missing route-specific consequences')
  const consequences = [next.slice(a, b).replace('**带着稿来：**', '').trim(), next.slice(b, common).replace('**带着明信片来：**', '').trim()]
  const after = [next.slice(common), part('### 画外 · 等待确认', '## 后续兑现约束')]
  const nodes = [], edges = []
  let last, sequence = 0
  const add = (type, data, scene) => {
    const id = `pc5-preview-${++sequence}`
    nodes.push({ id, type, position: { x: scene * 400, y: sequence * 100 }, data: { ...data, sceneGroupId: `pc5-preview-scene-${scene}`, sceneCode: `1-${scene}` } })
    if (last) edges.push({ id: `${last}-${id}`, source: last, target: id, animated: true })
    last = id
    return id
  }
  const prose = (text, scene) => {
    for (const paragraph of text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)) {
      add('subtitle', { role: '旁白', text: paragraph.replace(/\*\*/g, '') }, scene)
    }
  }
  const background = (url, scene) => add('background', { backgroundId: url }, scene)
  background('/assets/paint-chapter-four/commission-desk.webp', 1); prose(before[0], 1)
  background('/assets/paint-chapter-one/shop.webp', 2); prose(before[1], 2)
  background('/assets/paint-chapter-four/hall-afternoon.webp', 3); prose(before[2], 3)
  const choice = add('choice', { choices: ['留下来，陪许野排完离场', '先去河边，归还明信片'], effects: [[{ kind: 'setVariable', variable: 'pc5_keepsake', value: 'paper' }], [{ kind: 'setVariable', variable: 'pc5_keepsake', value: 'card' }]] }, 3)
  const tails = routes.map((route, index) => {
    last = undefined
    const entry = background(index ? '/assets/paint-chapter-one/river.webp' : '/assets/paint-chapter-four/hall-afternoon.webp', 4 + index)
    edges.push({ id: `${choice}-${entry}`, source: choice, target: entry, sourceHandle: `choice-${index}`, animated: true })
    prose(route, 4 + index)
    background('/assets/paint-chapter-one/shop.webp', 6 + index); prose(consequences[index], 6 + index)
    return last
  })
  last = undefined
  const merge = background('/assets/paint-chapter-one/shop.webp', 8)
  for (const tail of tails) edges.push({ id: `${tail}-${merge}`, source: tail, target: merge, animated: true })
  prose(after[0], 8)
  background('/assets/paint-chapter-four/commission-desk.webp', 9); prose(after[1], 9)
  return { nodes, edges }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const markdown = await readFile(new URL('../docs/story/paint/05-letter-draft.zh.md', import.meta.url), 'utf8')
  console.log(JSON.stringify(makePreviewGraph(markdown)))
}
