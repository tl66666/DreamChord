import type { StoryGraph, StoryNode, StoryNodeType, StoryEdge } from './types.js'
import { voiceTextHash, directVoiceLine } from './voiceDirection.js'
import { PAINT_LINES } from './paintLines.js'

type Role = '程见' | '夏禾' | '许野' | '陆青'
const art = '/assets/paint-prologue'
const sound = '/assets/audio/paint-prologue'
const slugs = { 程见: 'cheng', 夏禾: 'xia', 许野: 'ye', 陆青: 'lu' } as const
const nodes: StoryNode[] = [], edges: StoryEdge[] = []
let scene = 1, previous: string | undefined
const titles = ['一把待修的椅子', '八个观众', '散场以后', '深色的补笔']
function add(id: string, type: StoryNodeType, data: Record<string, unknown>) {
  nodes.push({ id, type, position: { x: scene * 480, y: nodes.length * 110 }, data: { ...data, sceneGroupId: `paint-scene-${scene}`, sceneTitle: titles[scene - 1], sceneCode: `序-${scene}` } })
  if (previous) edges.push({ id: `${previous}-${id}`, source: previous, target: id, animated: true })
  previous = id
  return id
}
function note(id: string, text: string, ja: string, extra: Record<string, unknown> = {}) {
  return add(id, 'subtitle', { role: '旁白', text, localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } }, ...extra })
}
function speech(id: typeof PAINT_LINES[number]['id']): StoryNode {
  const line = PAINT_LINES.find(l => l.id === id)!
  const { role, text, ja, emotion } = line
  return { id, type: 'dialogue', position: { x: 0, y: 0 }, data: {
    role, text, voiceDirection: directVoiceLine({ role, text, overrides: { emotion: emotion === 'serious' ? 'resolve' : 'neutral', intensity: emotion === 'serious' ? .4 : .3, pace: .98 } }),
    localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } },
    voiceTracks: { ja: { url: `${sound}/${id}-ja.ogg`, textHash: voiceTextHash(ja), profileId: `paint-voice-${slugs[role]}` } },
  } }
}
function line(id: typeof PAINT_LINES[number]['id'], extra: Record<string, unknown> = {}) { return add(id, 'dialogue', { ...speech(id).data, ...extra }) }
function lines(...ids: typeof PAINT_LINES[number]['id'][]) { ids.forEach(id => line(id)) }
function bg(id: string, name: string) { add(id, 'background', { backgroundId: `${art}/${name}.webp` }) }
function show(id: string, characterId: Role, expression: 'normal' | 'smile' | 'serious', position: 'left' | 'right' | 'center', action = 'show') { add(id, 'character', { characterId, expression, position, action }) }
const music = (track: string, volume = .55) => ({ bgm: { action: 'play', url: `${sound}/${track}.ogg`, volume, fadeInMs: 1600, fadeOutMs: 1600 } })

bg('p-workshop', 'workshop')
note('p-first-afternoon', '四月十七日，下午。\n许野借来的椅子，比他写的剧本还要老。\n\n我伸手去够桌上的钉子。夏禾正好推门进来。', '四月十七日、午後。\nイエが借りてきた椅子は、彼の台本よりずっと古かった。\n\n卓上の釘に手を伸ばしたところへ、ホーが入ってきた。', { audio: music('workshop') })
show('p-xia-arrives', '夏禾', 'serious', 'center')
lines('p-open-1', 'p-open-2')
note('p-fall', '喀。\n椅子朝左歪下去，我连人带钉子盒坐到了地上。钉子倒没撒——我把盒子护住了。', 'ぱき、と音がした。\n椅子が左へ傾き、釘の箱ごと床に尻もちをついた。釘はこぼれなかった。箱だけは抱え込んだ。', { audio: { sfx: [{ url: `${sound}/wood.ogg`, volume: .45 }] } })
show('p-xia-right', '夏禾', 'serious', 'right')
show('p-ye-arrives', '许野', 'smile', 'left')
lines('p-open-3', 'p-open-4', 'p-open-5', 'p-open-6', 'p-open-7', 'p-open-8', 'p-open-9')
note('p-room', '这间旧礼堂漏了两年雨，掌管钥匙的赵伯已经不肯再往屋顶爬。\n许野便说，演戏收一点钱。\n他印了三十张票，卖出去七张，又送了一张。那张送给了我。', 'この古い集会所は、二年前から雨漏りしていた。鍵を預かるおじさんも、もう屋根には上れない。\nそれでイエが、芝居をして修繕代を集めようと言い出した。\n三十枚刷った券は、七枚売れ、一枚はただで渡した。その一枚は僕のところにある。')
lines('p-repair-1', 'p-repair-2', 'p-repair-3', 'p-repair-4', 'p-repair-5', 'p-repair-6', 'p-repair-7', 'p-repair-8')
note('p-repair-work', '许野蹲下来，郑重地按住椅子，仿佛终于分到了一个重要角色。\n我锯下一段深色木头，削平接口，涂胶，再用两枚木销固定。\n夏禾递工具的顺序很熟练。第三次递错的时候，她开始念我的名字。', 'イエはしゃがみ込み、ようやく大役をもらったように椅子を押さえた。\n濃い色の木を切り、継ぎ目を削り、接着剤と二本の木栓で留める。\nホーは慣れた手つきで道具を渡した。三度目に違うものを渡してからは、先に僕の名前を呼ぶようになった。')
show('p-xia-smile', '夏禾', 'smile', 'right', 'change')
lines('p-task-1', 'p-task-2')
const choice = add('p-action-choice', 'choice', { choices: ['陪许野对一句台词', '留下来帮夏禾整理道具'], localizations: { ja: { choices: ['イエの台詞合わせに付き合う', 'ホーと小道具を片づける'] } } })
previous = undefined
lines('p-branch-ye-1', 'p-branch-ye-2', 'p-branch-ye-3')
note('p-ye-page', '他用嘴叼住笔帽，在纸边补了一行，又把“床得换”圈了两遍。\n写完，他把稿子转给夏禾看。她读了一遍，点点头，拿走了。', 'ペンのふたをくわえ、紙の端に一行書き足した。「ベッドは替えないと」に、丸を二つ。\nホーに見せると、彼女は一度読んでうなずき、そのまま台本を持っていった。', { audio: { sfx: [{ url: `${sound}/paper.ogg`, volume: .3 }] } })
const yeTail = previous!
edges.push({ id: 'p-choose-ye', source: choice, target: 'p-branch-ye-1', sourceHandle: 'choice-0', label: '对台词', animated: true })
previous = undefined
lines('p-branch-xia-1', 'p-branch-xia-2', 'p-branch-xia-3')
note('p-xia-tea', '杯子上有我替她粘过的缺口。我记得，她为这事生过气——她只是让我拿去洗。\n我没问过，她是不是想把那点缺口留下。\n这次，我把箱子推到她手边，没再打开。', 'カップには、僕が埋めた欠け跡があった。あのとき彼女は怒った。洗ってとしか頼んでいない、と。\nあの欠けを残しておきたいかなんて、聞きもしなかった。\n今日は、箱を彼女のそばへ寄せるだけにした。')
const xiaTail = previous!
edges.push({ id: 'p-choose-xia', source: choice, target: 'p-branch-xia-1', sourceHandle: 'choice-1', label: '整理道具', animated: true })
previous = undefined
note('p-before-stage', '胶干了。我把椅子放平，用力晃了晃。\n左后腿多了一截深胡桃色的木头，颜色有些突兀，坐上去却稳当。\n夏禾把它搬上舞台。我去门口收票。', '接着剤が乾いた。床に置き、強く揺すってみる。\n左の後ろ脚に、濃いクルミ色の木が継がれていた。色は目立つが、もうぐらつかない。\nホーが舞台へ運び、僕は入口に券を受け取りに行った。')
for (const tail of [yeTail, xiaTail]) edges.push({ id: `${tail}-merge`, source: tail, target: 'p-before-stage', animated: true })
lines('p-merge-1', 'p-merge-2', 'p-merge-3')

scene = 2
bg('p-theatre', 'theatre')
show('p-xia-stage', '夏禾', 'serious', 'right', 'change')
show('p-ye-stage', '许野', 'serious', 'left', 'change')
note('p-performance', '临开场，挂幕布的绳子松了。我只好留在侧边，把垂下来的布角托住。\n从这里看过去，舞台窄成了一道门。\n许野戴上灰胡子，夏禾拎着空皮箱。一个儿子，离家七年，今天回来。', '開演の直前、幕のひもが緩んだ。脇に残って、垂れた布の端を支える。\nここからだと、舞台は戸口ほどの幅しか見えない。\nイエは灰色のひげをつけ、ホーは空のトランクを持った。七年ぶりに帰ってくる息子の役だ。', { audio: { bgm: { action: 'stop', fadeOutMs: 1500 } } })
lines('p-stage-1', 'p-stage-2', 'p-stage-3')
note('p-forgotten-shoes', '许野低头。\n他的脚上，还穿着给“儿子”准备的那双大鞋。\n第二排有位阿姨先笑了，接着，笑声一排一排传过来。', 'イエが足元を見た。\n「息子」のために用意した大きな靴を、まだ自分で履いている。\n二列目のおばさんが先に笑い、隣へ、その隣へ、笑いが広がった。')
lines('p-stage-4', 'p-stage-5')
note('p-play-ends', '她把皮箱放下，弯腰挪动那只很轻的鞋柜。\n许野起身帮她，胡子掉了一半。他没去捡。\n我在幕布后面，看见那把补过的椅子被挪到了窗边。\n戏在这里结束。掌声不响，听得出每个人都在拍。', '彼女はトランクを置き、軽い靴棚をずらした。\nイエも立って手を貸す。ひげが半分落ちたが、拾わなかった。\n幕の陰から、直した椅子が窓辺へ運ばれていくのが見えた。\n芝居は、そこで終わった。大きくはない拍手の中に、一人ひとりの手の音が聞こえた。', { audio: { sfx: [{ url: `${sound}/applause.ogg`, volume: .32 }] } })

scene = 3
show('p-ye-after', '许野', 'smile', 'left', 'change')
show('p-xia-after', '夏禾', 'smile', 'right', 'change')
note('p-after-show', '散场后，我们数出了十一块七毛钱，和两张明天来取的馒头票。\n夏禾把硬币叠成几小摞。许野趴在桌上，划掉了第三幕的标题。', '終演後、集まったお金を数えた。十一元七角と、明日使えるパンの引換券が二枚。\nホーが小銭を積み上げる隣で、イエは台本の三幕目に線を引いた。', { audio: music('afterglow', .5) })
lines('p-after-1', 'p-after-2', 'p-after-3', 'p-after-4', 'p-after-5', 'p-after-6')
show('p-xia-serious-after', '夏禾', 'serious', 'right', 'change')
lines('p-after-7', 'p-after-8', 'p-after-9')
note('p-chair-offer', '她从台上搬下那把椅子，放在第一排正中。\n我拍掉围裙上的木屑，想把椅面再擦一下。她按住了我的手。', '舞台から、あの椅子を運んできて、一列目の真ん中に置く。\n前掛けの木くずを払い、座面も拭こうとしたら、手を押さえられた。')
lines('p-seat-1', 'p-seat-2', 'p-seat-3', 'p-seat-4', 'p-seat-5', 'p-seat-6')
show('p-xia-enjoys', '夏禾', 'smile', 'right', 'change')
note('p-second-performance', '我坐了下来。\n椅子很好，没有响。\n\n这回夏禾没提皮箱，也没有叫“爹”。她把小小的鞋柜推过来，问我鞋放在哪里。\n我指了指空着的那一格。\n许野在一旁咳嗽，说这已经不是他的剧本了。', '腰を下ろした。\n椅子は、音ひとつ立てなかった。\n\n今度のホーはトランクを持たず、「父さん」とも呼ばなかった。小さな靴棚を押してきて、靴をどこへ置こうかと聞く。\n空いた一段を指さした。\nイエが咳払いをして、もう俺の台本じゃないな、と言った。')
show('p-xia-exits', '夏禾', 'normal', 'right', 'hide')
show('p-ye-exits', '许野', 'normal', 'left', 'hide')
bg('p-repaired-detail', 'chair-repaired')
note('p-mark-remains', '送他们到门口的时候，灯还亮着。\n椅腿上的深色补木，我打算明天再磨一遍。\n窗没有关严，风把贴在玻璃上的旧戏票吹起一角。', '二人を戸口まで送ったとき、明かりはまだついていた。\n脚の濃い継ぎ木は、明日もう一度やすりをかけようと思った。\n閉めきっていない窓から風が入り、ガラスに貼った古い観劇券の角をめくった。')
bg('p-workshop-night', 'night')
show('p-xia-at-door', '夏禾', 'normal', 'center')
lines('p-walk-1', 'p-walk-2', 'p-walk-3', 'p-walk-4', 'p-walk-5')
show('p-ye-at-door', '许野', 'smile', 'left')
show('p-xia-door-right', '夏禾', 'smile', 'right')
lines('p-walk-6', 'p-walk-7')
note('p-goodnight', '许野不服气地追上去，开始介绍一条根本不存在的近路。\n夏禾回头朝我挥手。\n\n明天先问她六月哪天歇。\n我把这件事排在磨椅子前面。', 'イエは負けじと追いかけ、ありもしない近道の説明を始めた。\nホーが振り返って手を振る。\n\n明日はまず、六月の休みを聞こう。\n椅子のやすりがけより、先に。')

scene = 4
show('p-xia-gone', '夏禾', 'normal', 'right', 'hide')
show('p-ye-gone', '许野', 'normal', 'left', 'hide')
note('p-return', '我折回礼堂，取落在桌上的钥匙。\n灯光下有一条很短的影子，斜斜压着地上的木屑。\n\n那把椅子又歪了。', '机に忘れた鍵を取りに、集会所へ戻った。\n明かりの下で、短い影が床の木くずを斜めに横切っていた。\n\n椅子が、また傾いている。', { audio: { bgm: { action: 'stop', fadeOutMs: 1800 } } })
bg('p-erased-detail', 'chair-erased')
note('p-empty-patch', '左后腿断在原来的地方。\n没有被撬过的划痕，没有胶。两枚木销也不见了。\n\n我摸到的，是下午那道蛀空的断口。\n木屑还留在地板上。', '左の後ろ脚が、元と同じところで折れていた。\nこじ開けた傷も、接着剤もない。二本の木栓も消えている。\n\n指が触れたのは、昼間見た、虫食いの折れ口だった。\n木くずだけが、床に残っていた。', { audio: { bgm: { action: 'stop', fadeOutMs: 1200 } } })
line('p-night-1')
bg('p-outside', 'outside')
note('p-another-room', '同一夜，稍早。另一间工作室。\n\n一位年轻画家放下画笔，打开录音笔。\n她借着台灯俯身去看。画布上，窗边那把椅子，有一截格外深的颜色。', '同じ夜、少し前。別のアトリエ。\n\n若い画家が筆を置き、レコーダーをつけた。\nランプの下で身をかがめる。キャンバスの窓辺にある椅子には、一か所だけ濃い色があった。', { audio: { sfx: [{ url: `${sound}/paper.ogg`, volume: .22 }] } })
lines('p-outside-1', 'p-outside-2')
note('p-ending', '她停下笔，把“待确认”三个字圈了起来。\n\n那张草图上，椅子还是完好的。\n\n——序章 · 多出来的一把椅子——\n\n《请让这幅画老去》\n第一章预告：今天也有一场坏戏', '彼女はペンを止め、「要確認」の文字を丸で囲んだ。\n\n下絵の椅子は、まだ壊れていなかった。\n\n——序章・もう一脚の椅子——\n\n『どうか、この絵を老いさせて』\n第一章予告・今日も出来の悪い芝居がある')

export const PAINT_STARTER_CARD: StoryNode = { ...speech('your-next-line'), data: { ...speech('your-next-line').data, creatorStarter: true, audio: music('afterglow', .5) } }
export const PAINT_PROLOGUE = {
  id: 'dreamchord-paint-prologue', title: '请让这幅画老去', chapterTitle: '序章 · 多出来的一把椅子',
  description: '一把修好的椅子，一场只有八位观众的戏。散场后，刚刚接上的木头却不见了。原创文学幻想 · 序章 · 中文字幕 / 日语角色配音。',
  cover: `${art}/cover.webp`, graph: { nodes, edges } as StoryGraph,
  characters: [
    { slug: 'cheng', name: '程见', description: '22岁，道具与杂务师。手艺好，爱记口头账，也真心乐于帮朋友。比起修好东西，更需要学会先听完别人的愿望。', color: '#967b56', defaultSprite: `${art}/cheng-normal.png` },
    { slug: 'xia', name: '夏禾', description: '21岁，杂货铺店员兼演员。利落、爱笑，也会生气。她想去海边，不愿自己的认真话总被放到忙完以后。', color: '#587c7b', defaultSprite: `${art}/xia-normal.png` },
    { slug: 'ye', name: '许野', description: '24岁，业余编剧。戏不一定写得好，却认真在意每位观众。贫嘴时也会悄悄记下朋友说过的好句子。', color: '#9e6358', defaultSprite: `${art}/ye-normal.png` },
    { slug: 'lu', name: '陆青', description: '27岁，受托整理与续作的年轻画家。认真、克制，希望理解前辈留下的画稿。序章中仅以画外工作记录出现。', color: '#747c91', defaultSprite: `${art}/lu-normal.png` },
  ],
} as const
