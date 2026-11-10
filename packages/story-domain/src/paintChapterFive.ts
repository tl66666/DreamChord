import type { StoryGraph, StoryNode, StoryEdge, StoryNodeType } from './types.js'
import { directVoiceLine, voiceTextHash } from './voiceDirection.js'
import { PAINT_CHAPTER_FOUR } from './paintChapterFour.js'
import { PAINT_CHAPTER_FIVE_LINES } from './paintChapterFiveLines.js'
import { paintBgm, type PaintScoreId } from './paintScore.js'

export { PAINT_CHAPTER_FIVE_LINES } from './paintChapterFiveLines.js'
type Role = '程见' | '夏禾' | '许野' | '陆青' | '刘济安' | '沈芸'
const slugs: Record<Role, string> = { 程见: 'cheng', 夏禾: 'xia', 许野: 'ye', 陆青: 'lu', 刘济安: 'liu', 沈芸: 'shen' }
const nodes: StoryNode[] = [], edges: StoryEdge[] = []
const titles = ['画外 · 回执', '街口 · 等一封信', '一页和一封信', '空下来的位置', '河边的一面', '次日 · 回信的人', '画外 · 等待确认']
let scene = 1, previous: string | undefined
function add(short: string, type: StoryNodeType, data: Record<string, unknown>) {
  const id = `pc5-${short}`
  nodes.push({ id, type, position: { x: scene * 480, y: nodes.length * 110 }, data: { ...data, sceneGroupId: `paint-ch5-scene-${scene}`, sceneTitle: titles[scene - 1], sceneCode: `6-${scene}` } })
  if (previous) edges.push({ id: `${previous}-${id}`, source: previous, target: id, animated: true })
  previous = id
  return id
}
function n(id: string, text: string, ja: string, extra: Record<string, unknown> = {}) {
  return add(id, 'subtitle', { role: '旁白', text, localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } }, ...extra })
}
function l(...ids: string[]) {
  for (const short of ids) {
    const line = PAINT_CHAPTER_FIVE_LINES.find(item => item.id === `pc5-${short}`)
    if (!line) throw new Error(`Missing line ${short}`)
    const { role, text, ja, emotion } = line
    add(short, 'dialogue', { role, text, voiceDirection: directVoiceLine({ role, text, overrides: { emotion: emotion === 'serious' ? 'tense' : 'neutral', intensity: .3, pace: .98 } }), localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } }, voiceTracks: { ja: { url: `/assets/audio/paint-chapter-five/pc5-${short}-ja.ogg`, textHash: voiceTextHash(ja), profileId: `paint-voice-${slugs[role as Role]}` } } })
  }
}
function bg(id: string, url: string) { add(id, 'background', { backgroundId: url }) }
function show(id: string, role: Role, position: 'left' | 'right' | 'center', action = 'show') { add(id, 'character', { characterId: role, expression: 'normal', position, action }) }
const music = (track: PaintScoreId) => ({ audio: { bgm: paintBgm(track, .3) } })

bg('desk', '/assets/paint-chapter-four/commission-desk.webp')
n('desk-date', '画外，四月二十二日。陆青从楼下信箱里取出回执，纸角被雨水泡得起了毛。', '絵の外、四月二十二日。ルー・チンは階下の郵便受けから返事を取り出した。紙の角は雨で毛羽立っていた。', music('tam-atelier'))
n('desk-reply', '交接人没有回答“原意”。回信只写：六月中旬布展，五月二日前需要处理方案；交付签名只证明材料送达。', '引き継ぎ担当者は「本来の意図」に答えていない。六月半ばに展示準備、五月二日までに処置案が必要。受領欄の署名は資料の到着を示すだけだ。')
n('desk-deadline', '陆青在工作簿写下日期。她还剩十天。信里夹着借阅单：闻砚的另一份工作记录在旧街档案室，需要保管人签字。', 'ルー・チンは帳面に日付を書いた。残り十日。借覧票には、別の作業記録は旧街の資料室にあり、保管者の署名が必要とある。')
n('desk-sign', '她回信问保管人的联系方式。落款写了“修复与续作”，又在“续作”旁画一个问号，没有划掉。', '保管者の連絡先を尋ねる返事を書いた。署名の下に「修復と加筆」と記し、加筆の横に疑問符をつける。消しはしなかった。')
scene = 2
bg('shop', '/assets/paint-chapter-five/shop-letter.webp')
n('shop-date', '画内，四月二十二日下午。邮差走到杂货铺时，夏禾正称盐。秤盘一晃，细盐从纸角漏了几粒。', '絵の中、四月二十二日の午後。郵便配達が店に来たとき、ホーは塩を量っていた。皿が揺れ、紙の角から数粒こぼれた。', music('maou-acoustic29'))
show('shop-xia', '夏禾', 'center')
n('shop-envelope', '信封上是文化站的章。她擦净手，接过去，先压在账本下面。沈芸把等着付钱的人引到另一边。', '封筒には文化センターの印。彼女は手を拭いて受け取り、帳簿の下へ置いた。シェンは会計を待つ人を奥へ案内した。')
l('letter-1', 'letter-2', 'letter-3')
n('shop-ye', '许野抱着排练稿进门，曲别针下夹着一张空白明信片。他看见信封，没有问是谁寄的。', 'イエが稽古の原稿を抱えて来た。クリップに白紙の絵葉書が挟まっている。封筒を見ても、差出人は聞かなかった。')
show('shop-ye-show', '许野', 'left'); l('letter-4')
show('shop-shen', '沈芸', 'right'); l('letter-5')
n('shop-page', '许野收回硬币，没有接着讲笑话。程见发现他的稿子少了一页：送饭的人离开的那一页。', 'イエは硬貨を受け取り、冗談を続けなかった。原稿が一頁足りない。食事を届けた人が帰る場面だ。')
show('shop-xia-out', '夏禾', 'center', 'hide'); show('shop-shen-out', '沈芸', 'right', 'hide'); show('shop-ye-out', '许野', 'left', 'hide')
scene = 3
bg('hall', '/assets/paint-chapter-four/hall-afternoon.webp')
n('hall-page', '礼堂侧门的锁又涩了。许野说今天先别修，钥匙要按时归还。程见将工具袋留在门外，陪他摊开稿页。', '集会所の裏口の鍵がまた固い。今日は直さず、時間どおり返すとイエは言う。僕は道具袋を外に置き、一緒に原稿を広げた。')
show('hall-ye', '许野', 'center')
n('hall-endings', '缺的那页折在许野口袋里。一版送饭的人留下，另一版她带着碗走了。两个结尾，他都没有接着写。', '足りない頁はイエのポケットにあった。一つは食事を届けた人が残り、もう一つは椀を持って帰る。どちらの続きも書かれていない。')
l('hall-1', 'hall-2', 'hall-3')
n('hall-choice-intro', '刘叔一刻钟后要锁门。许野想再排一次；夏禾说晚饭后会带着信来，如果程见不在，就去河边找沈芸。', 'リウさんは十五分後に鍵をかける。イエはもう一度稽古したい。ホーは夕食後に手紙を持って来て、僕がいなければ川辺のシェンを訪ねると言った。')
const choice = add('choice', 'choice', { choices: ['留下来陪许野排练', '去河边找夏禾'], effects: [[{ kind: 'setVariable', variable: 'pc5_keepsake', value: 'paper' }], [{ kind: 'setVariable', variable: 'pc5_keepsake', value: 'card' }]], localizations: { ja: { choices: ['イエの稽古に付き合う', '川辺のホーを訪ねる'] } } })
previous = undefined; scene = 4
n('paper-start', '程见把碗放在凳上，退到门边。许野没有叫他回来，只问他是不是忘了拿自己的东西。', '僕は椀を腰掛けに置いて戸口へ下がった。イエは呼び止めず、荷物を忘れていないかと聞いた。')
l('paper-1', 'paper-2')
n('paper-rehearsal', '他们重来一次。许野等程见走出门，才说完后半句。门外没人接，他在稿边写：等她回来，不等于她答应留下。', 'もう一度やり直す。僕が戸を出てから、イエは後半を言った。返事はない。原稿の端に「戻るのを待つことは、残る約束ではない」と書く。')
l('paper-3')
n('paper-consequence', '次日，许野拿回稿，看见自己写的那一行没有被改。他将空着的结尾翻给夏禾看。', '翌日、イエは原稿を受け取った。自分の一行は直されていない。空いた結末をホーに見せる。'); l('paper-day')
const paperTail = previous!
previous = undefined; scene = 5
bg('river', '/assets/paint-chapter-five/river-after-rain.webp')
show('river-ye-out', '许野', 'center', 'hide')
n('river-start', '程见到河边时，夏禾正磕掉鞋底的沙。信已经拆开，折成四折，放在她膝上。', '川辺へ着くと、ホーは靴底の砂を払っていた。開けた手紙は四つに折り、膝の上にある。')
show('river-xia', '夏禾', 'center'); l('river-1', 'river-2', 'river-3', 'river-4')
n('river-letter', '巡演组邀请她参加下一轮排练，不是正式录取。五月三日要离开两天，四月二十六日前答复；费用还需核实。', '巡演組から次の稽古への誘い。正式採用ではない。五月三日から二日間出かけ、四月二十六日までに返事をする。費用はまだ確認が必要だ。')
l('river-5'); show('river-shen', '沈芸', 'left'); l('river-6')
n('card-consequence', '次日，许野收回明信片，没有接程见的玩笑。他说下次会亲自给夏禾；稿页仍在自己手里。', '翌日、イエは絵葉書を受け取り、僕の冗談には乗らなかった。次は自分でホーに渡すと言う。原稿はまだ彼の手元にある。'); l('card-day')
const cardTail = previous!
previous = undefined; scene = 6
bg('common-shop', '/assets/paint-chapter-five/shop-letter.webp')
show('common-xia', '夏禾', 'center'); show('common-ye', '许野', 'left'); show('common-shen', '沈芸', 'right')
n('common', '夏禾把回信告诉两人，决定先确认排班和费用，再亲自答复。许野没有立刻道喜，先问她两天后是否还愿意演他的戏。', 'ホーは二人に手紙のことを話した。勤務と費用を確かめてから自分で返事をする。イエはすぐ祝わず、二日後も芝居に出たいかと尋ねた。')
edges.push({ id: `${choice}-paper`, source: choice, target: 'pc5-paper-start', sourceHandle: 'choice-0', animated: true }, { id: `${choice}-river`, source: choice, target: 'pc5-river', sourceHandle: 'choice-1', animated: true }, { id: `${paperTail}-pc5-common-shop`, source: paperTail, target: 'pc5-common-shop', animated: true }, { id: `${cardTail}-pc5-common-shop`, source: cardTail, target: 'pc5-common-shop', animated: true })
l('common-1', 'common-2')
n('common-cabinet', '程见看见柜子背板的一枚旧钉旁露出浅色木痕。他记得那里贴过一小片红纸；夏禾却从仓库找到那张纸，四角没有撕破。', '戸棚の背板の古い釘のそばに、色の薄い跡がある。赤い紙が貼ってあったはずだ。だがホーは倉庫でその紙を見つけた。四隅は破れていない。')
n('common-record', '沈芸记得早晨擦柜时还看见它。她们都说没有揭过。程见没有碰柜子，只画下纸原来的位置。', 'シェンは朝、戸棚を拭いたときには見たという。二人とも剥がしていない。僕は戸棚に触れず、紙の位置を描き留めた。')
l('common-3', 'common-4')
n('common-boundary', '夏禾记下日期，没有替急着去进货的沈芸签名。柜台上的稿和明信片，都留给它们的主人。', 'ホーは日付を記し、仕入れに急ぐシェンの代わりに署名しなかった。原稿も絵葉書も、それぞれの持ち主に返す。')
show('common-xia-out', '夏禾', 'center', 'hide'); show('common-shen-out', '沈芸', 'right', 'hide'); show('common-ye-out', '许野', 'left', 'hide')
scene = 7
bg('outside', '/assets/paint-chapter-four/commission-desk.webp')
n('outside-reply', '画外，陆青收到短讯：保管人周五可见，愿带工作记录，但不允许当场拍照。会面并不等于续作许可。', '絵の外。ルー・チンに短い連絡が来た。保管者は金曜に会い、記録を持参するが、その場での撮影は許さない。面会は加筆の許可ではない。', music('tam-atelier'))
show('outside-lu', '陆青', 'center'); l('outside-1')
n('outside-photo', '她完成边缘的临时保护，附上处理前照片。照片里柜门只露出窄窄一角，是否有红纸，分辨不清。', '縁の仮保護を終え、処置前の写真を添えた。写真には戸棚の扉がわずかに写るだけで、赤い紙があるかは判別できない。')
n('outside-question', '她在第一页夹入问题：损坏的材料与有意留下的空处重叠时，谁来决定如何处理？', '一頁目に問いを挟む。傷んだ材料と意図的に残された空白が重なるとき、処置を誰が決めるのか。')
n('ending', '楼下信箱的金属盖合上。陆青没有立刻下楼。她洗净刷子，写完这一行工作记录，才拿起钥匙。', '階下で郵便受けの蓋が閉まった。ルー・チンはすぐには降りず、筆を洗い、作業記録の一行を書き終えてから鍵を取った。')

export const PAINT_CHAPTER_FIVE = {
  id: PAINT_CHAPTER_FOUR.id, title: PAINT_CHAPTER_FOUR.title, chapterTitle: '第五章 · 给尚未寄出的回信',
  description: '一封回信带来新的排练机会，画外的委托也有了期限。程见的选择改变谁得到陪伴，以及次日带回的东西。',
  cover: PAINT_CHAPTER_FOUR.cover, characters: PAINT_CHAPTER_FOUR.characters, graph: { nodes, edges } as StoryGraph,
} as const
