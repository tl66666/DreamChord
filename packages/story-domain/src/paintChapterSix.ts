import type { StoryGraph, StoryNode, StoryEdge, StoryNodeType } from './types.js'
import { directVoiceLine, voiceTextHash } from './voiceDirection.js'
import { PAINT_CHAPTER_FIVE } from './paintChapterFive.js'
import { PAINT_CHAPTER_SIX_LINES } from './paintChapterSixLines.js'
import { paintBgm } from './paintScore.js'

export { PAINT_CHAPTER_SIX_LINES } from './paintChapterSixLines.js'
type Role = '程见' | '夏禾' | '许野' | '陆青' | '刘济安' | '沈芸'
const slugs: Record<Role, string> = { 程见: 'cheng', 夏禾: 'xia', 许野: 'ye', 陆青: 'lu', 刘济安: 'liu', 沈芸: 'shen' }
const nodes: StoryNode[] = [], edges: StoryEdge[] = []
const titles = ['画外 · 不带走的记录', '街口 · 尚未填满的日历', '礼堂 · 傍晚以后', '先问排班', '先整理问题', '回信之前', '画外 · 暂不补画']
let scene = 1, previous: string | undefined
function add(short: string, type: StoryNodeType, data: Record<string, unknown>) {
  const id = `pc6-${short}`
  nodes.push({ id, type, position: { x: scene * 480, y: nodes.length * 110 }, data: { ...data, sceneGroupId: `paint-ch6-scene-${scene}`, sceneTitle: titles[scene - 1], sceneCode: `7-${scene}` } })
  if (previous) edges.push({ id: `${previous}-${id}`, source: previous, target: id, animated: true })
  previous = id
  return id
}
function n(id: string, text: string, ja: string, extra: Record<string, unknown> = {}) {
  return add(id, 'subtitle', { role: '旁白', text, localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } }, ...extra })
}
function l(...ids: string[]) {
  for (const short of ids) {
    const line = PAINT_CHAPTER_SIX_LINES.find(item => item.id === `pc6-${short}`)
    if (!line) throw Error(`Missing line ${short}`)
    const { role, text, ja, emotion } = line
    add(short, 'dialogue', { role, text, voiceDirection: directVoiceLine({ role, text, overrides: { emotion: emotion === 'serious' ? 'tense' : 'neutral', intensity: .3, pace: .98 } }), localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } }, voiceTracks: { ja: { url: `/assets/audio/paint-chapter-six/pc6-${short}-ja.ogg`, textHash: voiceTextHash(ja), profileId: `paint-voice-${slugs[role as Role]}` } } })
  }
}
function bg(id: string, url: string) { add(id, 'background', { backgroundId: url }) }
function show(id: string, role: Role, position: 'left' | 'right' | 'center', action = 'show') { add(id, 'character', { characterId: role, expression: 'normal', position, action }) }

bg('archive', '/assets/paint-chapter-six/archive-room.webp')
n('archive-date', '画外，周五。档案室的保管人把布盒推到桌子中央，提醒陆青：可以记笔记，不能拍照。', '絵の外、金曜日。資料室の管理者は布張りの箱を机の中央に置き、撮影はできないがメモは取れると告げた。', { audio: { bgm: paintBgm('tam-atelier', .3) } })
show('archive-lu', '陆青', 'center'); l('archive-1')
n('archive-note', '工作记录上有两种墨色。一条写着将红纸另存，日期早于画作交付；旁边没有说明谁取走，也没有写明它后来去了哪里。', '作業記録には二色のインクがある。赤い紙を別に保管したという記載は引き渡しより前の日付だ。誰が持ち出し、その後どこへ行ったかは書かれていない。')
l('archive-2'); n('archive-copy', '陆青只抄下获准记录的日期和原词，把自己的问题另起一栏。保管人合上盒盖，没有让她带走那一页。', '許可された日付と原文だけを書き写し、疑問は別の欄に記す。管理者は箱を閉じ、その頁を持ち出すことは許さなかった。'); l('archive-3')
show('archive-lu-out', '陆青', 'center', 'hide')
scene = 2; bg('shop', '/assets/paint-chapter-five/shop-letter.webp')
n('shop-date', '画内，四月二十四日。夏禾把排班日历摊在柜台上，先圈出五月三日和四日，又在四月二十六日旁画了一个小点。', '絵の中、四月二十四日。ホーは勤務表をカウンターに広げ、五月三日と四日を丸で囲み、四月二十六日に小さな点をつけた。', { audio: { bgm: paintBgm('maou-acoustic29', .3) } })
show('shop-xia', '夏禾', 'center'); show('shop-shen', '沈芸', 'right'); l('shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5')
n('shop-list', '她写下三个问题：车费怎么报，住哪里，最晚何时回来。程见想替她加上“请务必照顾”，笔尖停在纸外，最后只把电话递给她。', '交通費の精算、宿泊先、帰る時刻。ホーは三つの質問を書いた。僕は「よろしくお願いします」と足しかけてペンを止め、電話だけを渡した。')
show('shop-xia-out', '夏禾', 'center', 'hide'); show('shop-shen-out', '沈芸', 'right', 'hide')
scene = 3; bg('hall', '/assets/paint-chapter-four/hall-afternoon.webp')
n('hall-arrival', '礼堂门口，许野正把排练时间从纸上剪下来。刘叔按住另一头，免得他把借用表也一并剪断。', '集会所の前で、イエは稽古時間の紙を切り取っていた。リウさんが借用表まで切られないよう、反対側を押さえる。')
show('hall-ye', '许野', 'left'); show('hall-liu', '刘济安', 'right'); l('hall-1', 'hall-2', 'hall-3')
n('hall-choice', '时间只够先办一件：帮沈芸问清下午的换班，或陪夏禾把要问巡演组的问题整理好。另一件不能因此算作已经办妥。', '先にできるのは一つだけ。シェンの代わりに午後の交代を聞きに行くか、ホーと巡演組への質問を整理するか。もう一方が済んだことにはならない。')
const choice = add('choice', 'choice', { choices: ['先去问下午的换班', '先陪夏禾整理问题'], localizations: { ja: { choices: ['午後の交代を先に聞きに行く', 'ホーと質問を先に整理する'] } }, effects: [[{ kind: 'setVariable', variable: 'pc6_first', value: 'schedule' }], [{ kind: 'setVariable', variable: 'pc6_first', value: 'question' }]] })
previous = undefined; scene = 4
show('schedule-ye-out', '许野', 'left', 'hide'); show('schedule-liu-out', '刘济安', 'right', 'hide'); bg('schedule-shop', '/assets/paint-chapter-five/shop-letter.webp')
show('schedule-shen', '沈芸', 'right'); n('schedule-start', '沈芸翻出旧日历，指给程见看哪位邻居可能有空。她没有把对方的名字直接填进表格。', 'シェンは古い暦を出し、時間がありそうな近所の人を教えた。名前はまだ表に書かない。'); l('schedule-1', 'schedule-2')
n('schedule-consequence', '程见走了一趟，对方说要回家确认，晚上再给沈芸答复。他把这句话原样带回，没有说成“已经安排好了”。', '僕が尋ねると、相手は家で確かめてから夜に返事をすると言った。その言葉をそのまま伝え、「決まった」とは言わなかった。')
const scheduleTail = previous!
previous = undefined; scene = 5
show('question-ye-out', '许野', 'left', 'hide'); show('question-liu-out', '刘济安', 'right', 'hide'); bg('question-shop', '/assets/paint-chapter-five/shop-letter.webp')
show('question-xia', '夏禾', 'center'); n('question-start', '夏禾把信纸分成两栏，一边写已经知道的，一边写还要问的。住宿一栏仍然空着。', 'ホーは紙を二つに分け、わかっていることと、まだ聞くことを書いた。宿泊の欄は空いたままだ。'); l('question-1', 'question-2')
n('question-consequence', '电话占线，她没有连着重拨。程见把问题留在柜台，等夏禾忙完手里的客人，再由她自己打过去。', '電話は話し中だった。ホーは続けてかけ直さず、客の会計を済ませた後、自分で電話することにした。')
const questionTail = previous!
previous = undefined; scene = 6; bg('join-shop', '/assets/paint-chapter-five/shop-letter.webp')
show('join-xia', '夏禾', 'center'); show('join-shen', '沈芸', 'right'); show('join-ye', '许野', 'left')
edges.push({ id: `${choice}-schedule`, source: choice, target: 'pc6-schedule-ye-out', sourceHandle: 'choice-0', animated: true }, { id: `${choice}-question`, source: choice, target: 'pc6-question-ye-out', sourceHandle: 'choice-1', animated: true }, { id: `${scheduleTail}-join`, source: scheduleTail, target: 'pc6-join-shop', animated: true }, { id: `${questionTail}-join`, source: questionTail, target: 'pc6-join-shop', animated: true })
n('join-later', '傍晚，夏禾打通了电话。她听完，重新念了一遍自己的记录；沈芸也问到了愿意换班的人，但还约了晚上核对。', '夕方、ホーは電話をつなぎ、聞いた内容を読み返した。シェンも交代できる人を見つけたが、夜にもう一度確認する約束だ。'); l('join-1', 'join-2', 'join-3', 'join-4')
n('join-letter', '夏禾写好回信，只承诺参加下一轮排练；住宿条件还要等对方书面答复。信封上的地址她核了两遍，交邮前把笔盖扣紧。', 'ホーは次の稽古に参加したいとだけ返事を書いた。宿泊条件は書面での回答を待つ。封筒の宛先を二度確かめ、ペンの蓋を閉めた。')
show('join-xia-out', '夏禾', 'center', 'hide'); show('join-shen-out', '沈芸', 'right', 'hide'); show('join-ye-out', '许野', 'left', 'hide')
scene = 7; bg('outside', '/assets/paint-chapter-four/commission-desk.webp')
n('outside-return', '画外，陆青把抄下的日期放在处理方案旁边。那条旧记录说明红纸曾被另存，却不能解释今天画面里的变化。', '絵の外。ルー・チンは書き写した日付を処置案の横に置いた。古い記録は赤い紙が別に保管されたことを示すが、今の画面の変化は説明できない。', { audio: { bgm: paintBgm('tam-atelier', .3) } })
show('outside-lu', '陆青', 'center'); l('outside-1', 'outside-2')
n('ending', '她在方案上留出一个空格，写下等待核实的事项。窗外雨停了，纸上那一小块空白还在。', '処置案に空欄を残し、確認を待つ項目を書いた。窓の外では雨がやみ、紙の小さな余白はそのまま残っている。')

export const PAINT_CHAPTER_SIX = {
  id: PAINT_CHAPTER_FIVE.id, title: PAINT_CHAPTER_FIVE.title, chapterTitle: '第六章 · 在雨停以前回信',
  description: '夏禾核对巡演的条件并亲手写下回信；画外，陆青在档案里找到一条仍需辨认的旧记录。',
  cover: PAINT_CHAPTER_FIVE.cover, characters: PAINT_CHAPTER_FIVE.characters, graph: { nodes, edges } as StoryGraph,
} as const
