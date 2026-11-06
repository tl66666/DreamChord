import type { StoryGraph, StoryNode, StoryNodeType, StoryEdge } from './types.js'
import { voiceTextHash, directVoiceLine } from './voiceDirection.js'
import { PAINT_LINES } from './paintLines.js'
import { PAINT_NARRATION } from './paintNarration.js'
import { applyPaintScore } from './paintScore.js'

type Role = '程见' | '夏禾' | '许野' | '陆青'
const art = '/assets/paint-prologue', sound = '/assets/audio/paint-prologue'
const slugs = { 程见: 'cheng', 夏禾: 'xia', 许野: 'ye', 陆青: 'lu' } as const
const nodes: StoryNode[] = [], edges: StoryEdge[] = []
let scene = 1, previous: string | undefined
const titles = ['一张没有剪口的票', '八个观众', '散场以后', '深色的补笔']
function add(id: string, type: StoryNodeType, data: Record<string, unknown>) {
  nodes.push({ id, type, position: { x: scene * 480, y: nodes.length * 110 }, data: { ...data, sceneGroupId: `paint-scene-${scene}`, sceneTitle: titles[scene - 1], sceneCode: `1-${scene}` } })
  if (previous) edges.push({ id: `${previous}-${id}`, source: previous, target: id, animated: true })
  previous = id
  return id
}
function note(id: keyof typeof PAINT_NARRATION, extra: Record<string, unknown> = {}) {
  const { zh, ja } = PAINT_NARRATION[id]
  return add(id, 'subtitle', { role: '旁白', text: zh, localizations: { ja: { text: ja, sourceHash: voiceTextHash(zh) } }, ...extra })
}
function speech(id: typeof PAINT_LINES[number]['id']): StoryNode {
  const { role, text, ja, emotion } = PAINT_LINES.find(l => l.id === id)!
  const intention = id === 'p-night-1' ? 'afraid' : id === 'p-open-1' ? 'tense' : id === 'p-walk-1' ? 'warm' : id === 'p-walk-3' ? 'sad' : 'neutral'
  return { id, type: 'dialogue', position: { x: 0, y: 0 }, data: {
    role, text, voiceDirection: directVoiceLine({ role, text, overrides: { emotion: intention, intensity: emotion === 'serious' ? .4 : .3, pace: .98 } }),
    localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } },
    voiceTracks: { ja: { url: `${sound}/${id}-ja.ogg`, textHash: voiceTextHash(ja), profileId: `paint-voice-${slugs[role]}` } },
  } }
}
function line(id: typeof PAINT_LINES[number]['id']) { return add(id, 'dialogue', speech(id).data) }
function lines(...ids: typeof PAINT_LINES[number]['id'][]) { ids.forEach(id => line(id)) }
function bg(id: string, name: string) { add(id, 'background', { backgroundId: `${art}/${name}.webp` }) }
function show(id: string, characterId: Role, expression: 'normal' | 'smile' | 'serious', position: 'left' | 'right' | 'center', action = 'show') { add(id, 'character', { characterId, expression, position, action }) }
const music = (track: string, volume = .55) => ({ bgm: { action: 'play', url: `${sound}/${track}.ogg`, volume, fadeInMs: 2400, fadeOutMs: 1600 } })
const page = { audio: { sfx: [{ url: `${sound}/paper.ogg`, volume: .24 }] } }

// An invitation and a particular life come before the incident and the first voice.
bg('p-home', 'home')
note('p-epigraph')
note('p-invitation', { audio: music('workshop', .5) })
note('p-name')
note('p-home-window')
note('p-out-the-door')
note('p-hall-history')
bg('p-workshop', 'workshop')
note('p-first-afternoon')
show('p-xia-arrives', '夏禾', 'serious', 'center')
lines('p-open-1', 'p-open-2')
note('p-fall', { audio: { sfx: [{ url: `${sound}/wood.ogg`, volume: .42 }] } })
show('p-xia-right', '夏禾', 'serious', 'right')
show('p-ye-arrives', '许野', 'smile', 'left')
lines('p-open-3', 'p-open-4')
note('p-ye-paper')
lines('p-open-5', 'p-open-6')
note('p-hands')
lines('p-open-7', 'p-open-8', 'p-open-9')
note('p-room')
note('p-repair-observe')
lines('p-repair-1', 'p-repair-2', 'p-repair-3', 'p-repair-4')
note('p-cloth')
lines('p-repair-5', 'p-repair-6', 'p-repair-7', 'p-repair-8')
note('p-repair-work')
show('p-xia-smile', '夏禾', 'smile', 'right', 'change')
note('p-drying')

// A book and a failed adaptation are physical work in progress, not a philosophy lecture.
show('p-xia-book-off', '夏禾', 'normal', 'right', 'hide')
show('p-ye-book-off', '许野', 'normal', 'left', 'hide')
bg('p-keepsake', 'keepsake')
note('p-wilde-book', page)
note('p-unwritten-stage')
note('p-wilde-pencil')
note('p-books-return')
bg('p-back-from-book', 'workshop')
show('p-ye-with-script', '许野', 'normal', 'left')
show('p-xia-with-props', '夏禾', 'normal', 'right')
lines('p-task-1', 'p-task-2')
note('p-before-choice')
const choice = add('p-action-choice', 'choice', { choices: ['陪许野对一句台词', '留下来帮夏禾整理道具'], localizations: { ja: { choices: ['イエの台詞合わせに付き合う', 'ホーと小道具を片づける'] } } })
previous = undefined
lines('p-branch-ye-1', 'p-branch-ye-2', 'p-branch-ye-3')
note('p-ye-page', page)
note('p-ye-stop')
const yeTail = previous!
edges.push({ id: 'p-choose-ye', source: choice, target: 'p-branch-ye-1', sourceHandle: 'choice-0', label: '对台词', animated: true })
previous = undefined
lines('p-branch-xia-1', 'p-branch-xia-2', 'p-branch-xia-3')
note('p-xia-tea')
note('p-xia-silence')
const xiaTail = previous!
edges.push({ id: 'p-choose-xia', source: choice, target: 'p-branch-xia-1', sourceHandle: 'choice-1', label: '整理道具', animated: true })
previous = undefined
note('p-before-stage')
for (const tail of [yeTail, xiaTail]) edges.push({ id: `${tail}-merge`, source: tail, target: 'p-before-stage', animated: true })
note('p-ticket-reserve')
note('p-audience')
lines('p-merge-1', 'p-merge-2', 'p-merge-3')

scene = 2
bg('p-theatre', 'theatre-sea')
show('p-xia-stage', '夏禾', 'serious', 'right', 'change')
show('p-ye-stage', '许野', 'serious', 'left', 'change')
note('p-aunt-seat')
note('p-performance', { audio: { bgm: { action: 'stop', fadeOutMs: 1500 } } })
note('p-side-wing')
note('p-quiet-wait')
lines('p-stage-1', 'p-stage-2', 'p-stage-3')
note('p-forgotten-shoes')
lines('p-stage-4', 'p-stage-5')
note('p-moving-cabinet')
note('p-play-ends', { audio: { sfx: [{ url: `${sound}/applause.ogg`, volume: .32 }] } })
note('p-unsplit-ticket')

scene = 3
show('p-ye-after', '许野', 'smile', 'left', 'change')
show('p-xia-after', '夏禾', 'smile', 'right', 'change')
note('p-after-show', { audio: music('afterglow', .5) })
lines('p-after-1', 'p-after-2')
note('p-ye-laugh')
lines('p-after-3', 'p-after-4')
note('p-counter-coins')
note('p-xia-calls')
lines('p-after-5', 'p-after-6')
show('p-xia-serious-after', '夏禾', 'serious', 'right', 'change')
lines('p-after-7', 'p-after-8')
note('p-behind-curtain')
line('p-after-9')
note('p-chair-offer')
line('p-seat-1')
note('p-known-invitation')
lines('p-seat-2', 'p-seat-3')
note('p-seat-pauses')
lines('p-seat-4', 'p-seat-5', 'p-seat-6')
note('p-sit')
show('p-xia-enjoys', '夏禾', 'smile', 'right', 'change')
note('p-second-performance')
note('p-after-curtain')
show('p-xia-exits', '夏禾', 'normal', 'right', 'hide')
show('p-ye-exits', '许野', 'normal', 'left', 'hide')
note('p-wilde-return')
bg('p-repaired-detail', 'chair-repaired')
note('p-mark-remains')
bg('p-workshop-night', 'night')
note('p-open-window')
show('p-xia-at-door', '夏禾', 'normal', 'center')
lines('p-walk-1', 'p-walk-2')
note('p-summer-request')
lines('p-walk-3', 'p-walk-4', 'p-walk-5')
note('p-walk-breath')
show('p-ye-at-door', '许野', 'smile', 'left')
show('p-xia-door-right', '夏禾', 'smile', 'right')
lines('p-walk-6', 'p-walk-7')
note('p-goodnight')

scene = 4
show('p-xia-gone', '夏禾', 'normal', 'right', 'hide')
show('p-ye-gone', '许野', 'normal', 'left', 'hide')
note('p-return', { audio: { bgm: { action: 'stop', fadeOutMs: 1800 } } })
bg('p-erased-detail', 'chair-erased')
note('p-empty-patch', { audio: { bgm: { action: 'stop', fadeOutMs: 1200 } } })
note('p-proof-ticket')
line('p-night-1')
bg('p-outside', 'outside')
note('p-another-room')
note('p-brush-swab', page)
lines('p-outside-1', 'p-outside-2')
note('p-outside-close')
bg('p-back-to-hall', 'chair-erased')
note('p-ending')

applyPaintScore(nodes, [
  { nodeId: 'p-invitation', track: 'ds-chaolu', volume: .48 },
  { nodeId: 'p-first-afternoon', track: 'tam-atelier', volume: .52 },
  { nodeId: 'p-ye-paper', track: 'amacha-tanken', volume: .4 },
  { nodeId: 'p-repair-work', track: 'tam-atelier', volume: .48 },
  { nodeId: 'p-wilde-book', track: 'maou-piano12', volume: .32 },
  { nodeId: 'p-before-choice', track: 'tam-atelier', volume: .46 },
  { nodeId: 'p-after-show', track: 'amacha-tanken', volume: .38 },
  { nodeId: 'p-chair-offer', track: 'tam-ame', volume: .52 },
  { nodeId: 'p-wilde-return', track: 'maou-piano12', volume: .3 },
  { nodeId: 'p-open-window', track: 'maou-acoustic29', volume: .45 },
  { nodeId: 'p-another-room', track: 'amacha-yume', volume: .28 },
  { nodeId: 'p-ending', stop: true },
])

export const PAINT_LITERARY_SOURCES = [
  { nodeId: 'p-epigraph', author: '宫泽贤治', title: '银河铁道之夜', url: 'https://www.aozora.gr.jp/cards/000081/files/456_15050.html', use: '公开原文的一句问句，自译中文；侍奉与接受关爱的行动线在序章回应，未宣称回答全篇问题。' },
  { nodeId: 'p-wilde-book', author: 'Oscar Wilde', title: 'The Artist (Poems in Prose)', url: 'https://www.gutenberg.org/files/774/774-h/774-h.htm', use: '公版散文诗的原意概述与两座铜像的译名；许野的未完成改编稿与今晚家常戏为原创。' },
] as const
export const PAINT_STARTER_CARD: StoryNode = { ...speech('your-next-line'), data: { ...speech('your-next-line').data, creatorStarter: true, audio: music('afterglow', .5) } }
export const PAINT_PROLOGUE = {
  id: 'dreamchord-paint-prologue', title: '请让这幅画老去', chapterTitle: '序章 · 多出来的一把椅子',
  description: '“七点，第一排。今天不许帮忙。”夏禾在入场券背面这样写。可散场时，我口袋里的票仍没有剪口。一张未用的票、一场小戏与被抹去的生活痕迹。文学幻想序章 · 中文字幕 / 日语角色配音。',
  cover: `${art}/home.webp`, graph: { nodes, edges } as StoryGraph,
  characters: [
    { slug: 'cheng', name: '程见', description: '22岁，道具与杂务师。手艺好，爱记口头账，也真心乐于帮朋友。比起修好东西，更需要学会先听完别人的愿望。', color: '#967b56', defaultSprite: `${art}/cheng-normal.png` },
    { slug: 'xia', name: '夏禾', description: '21岁，杂货铺店员兼演员。利落、爱笑，也会生气。她想去海边，不愿自己的认真话总被放到忙完以后。', color: '#587c7b', defaultSprite: `${art}/xia-normal.png` },
    { slug: 'ye', name: '许野', description: '24岁，业余编剧。戏不一定写得好，却认真在意每位观众。贫嘴时也会悄悄记下朋友说过的好句子。', color: '#9e6358', defaultSprite: `${art}/ye-normal.png` },
    { slug: 'lu', name: '陆青', description: '27岁，受托整理与续作的年轻画家。认真、克制，希望理解前辈留下的画稿。序章中仅以画外工作记录出现。', color: '#747c91', defaultSprite: `${art}/lu-normal.png` },
  ],
} as const
