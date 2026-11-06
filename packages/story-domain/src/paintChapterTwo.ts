import type { StoryGraph, StoryNode, StoryEdge, StoryNodeType } from './types.js'
import { voiceTextHash, directVoiceLine } from './voiceDirection.js'
import { PAINT_PROLOGUE } from './paintPrologue.js'
import { PAINT_CHAPTER_TWO_LINES } from './paintChapterTwoLines.js'
import { paintBgm, type PaintScoreId } from './paintScore.js'
export { PAINT_CHAPTER_TWO_LINES } from './paintChapterTwoLines.js'

type Role = '程见' | '夏禾' | '许野'
const slugs = { 程见: 'cheng', 夏禾: 'xia', 许野: 'ye' } as const
const art = '/assets/paint-chapter-two', old = '/assets/paint-prologue', one = '/assets/paint-chapter-one'
const nodes: StoryNode[] = [], edges: StoryEdge[] = []
const titles = ['能关上的门', '一封拆晚的信', '三点与四点', '不是笑出来的', '门外的座位', '画外 · 两张原貌']
let scene = 1, previous: string | undefined
function add(short: string, type: StoryNodeType, data: Record<string, unknown>) {
  const id = `pc2-${short}`
  nodes.push({ id, type, position: { x: scene * 480, y: nodes.length * 110 }, data: { ...data, sceneGroupId: `paint-ch2-scene-${scene}`, sceneTitle: titles[scene - 1], sceneCode: `3-${scene}` } })
  if (previous) edges.push({ id: `${previous}-${id}`, source: previous, target: id, animated: true })
  previous = id
  return id
}
function n(id: string, zh: string, ja: string, extra: Record<string, unknown> = {}) {
  return add(id, 'subtitle', { role: '旁白', text: zh, localizations: { ja: { text: ja, sourceHash: voiceTextHash(zh) } }, ...extra })
}
function l(...ids: string[]) {
  for (const short of ids) {
    const line = PAINT_CHAPTER_TWO_LINES.find(l => l.id === `pc2-${short}`)
    if (!line) throw new Error(`Missing dialogue: ${short}`)
    const { role, text, ja, emotion } = line
    add(short, 'dialogue', { role, text,
      voiceDirection: directVoiceLine({ role, text, overrides: { emotion: emotion === 'serious' ? 'tense' : 'neutral', intensity: .32, pace: .98 } }),
      localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } },
      voiceTracks: { ja: { url: `/assets/audio/paint-chapter-two/pc2-${short}-ja.ogg`, textHash: voiceTextHash(ja), profileId: `paint-voice-${slugs[role]}` } },
    })
  }
}
function bg(id: string, file: string, folder = art) { add(id, 'background', { backgroundId: `${folder}/${file}.webp` }) }
function show(id: string, role: Role, expression: 'normal' | 'smile' | 'serious', position: 'left' | 'right' | 'center', action = 'show') { add(id, 'character', { characterId: role, expression, position, action }) }
const music = (track: PaintScoreId, volume = .5) => ({ audio: { bgm: paintBgm(track, volume) } })
const quiet = { audio: { bgm: { action: 'stop', fadeOutMs: 1400 } } }
const paper = { audio: { sfx: [{ url: '/assets/audio/paint-prologue/paper.ogg', volume: .18 }] } }

scene = 1
bg('home', 'home', old)
n('door-work', '四月十九日，早晨。\n我推了推门。门闩留在该待的地方，没有往下滑。昨晚拧最后一枚螺丝时，楼下已经熄了灯。\n试到第三下，门外有人敲了两声。我赶紧把它打开。', '四月十九日、朝。\n戸を押してみる。掛け金は、ずり落ちずに収まっていた。夕べ、最後のねじを締めたころには、階下の明かりも消えていた。\n三度目で、外から二つ、戸を叩く音がした。慌てて開ける。', music('tam-atelier', .48))
show('xia-door', '夏禾', 'normal', 'center')
l('home-1', 'home-2')
n('door-look', '夏禾扶着门边，也推了一下。她没看桌上剩下的工具，先看那枚被我拧花了的螺丝。\n我本来准备了好几句关于这副旧门闩的话。她从布袋里取出一只信封，我就没再说。', 'ホーも戸の端を押した。卓上の道具より先に、僕が頭を潰しかけたねじを見る。\nこの古い掛け金のことなら、いくらでも話せそうだった。けれど、彼女が袋から封筒を出したので、やめた。')
l('home-3', 'home-4', 'home-5')
n('walk-to-shop', '信封的边被拆得很乱，一条细纸还挂在封口。她没递给我，只用两根手指夹着。\n我取了外套，跟她下楼。走过最后一级台阶时，忍不住又回头看了一眼门。\n这次，它关得很好。', '封の端は、ぎざぎざに破れていて、細い紙がまだついていた。彼女は渡さず、指二本で挟んでいる。\n上着を取り、一緒に階段を降りた。最後の段で、つい戸を振り返る。\n今日は、ちゃんと閉まっていた。')

scene = 2
show('shop-hide', '夏禾', 'normal', 'center', 'hide')
bg('shop', 'shop', one)
n('cup-still', '杯子还在柜台上。夏禾把它倒过来给我看，杯底的小黑点依旧，边沿仍然平整。\n她把阿姨也问了一遍。阿姨记得去年捡过碎片，别的却说不出什么。\n信封搁到杯子旁，她的手一直没松。', 'カップは台の上にあった。底の黒い点は同じで、縁はまだ滑らかだ。\nおばさんにも聞いたという。去年、かけらを拾ったことは覚えていたが、それ以上は分からない。\nホーは封筒をカップのそばへ置き、まだ手を離さなかった。', music('maou-acoustic29', .43))
show('letter-xia', '夏禾', 'normal', 'right')
l('shop-1', 'shop-2', 'shop-3')
n('letter-date', '她这才把信推给我。信纸上没有说她已经被选中，只请她到文化站试一段戏。\n四月十九日，下午四点。要带的东西只有回信和一段准备好的台词。\n日期下面，被铅笔轻轻划过一道。', 'そこで、ようやく手紙を押してよこした。合格の知らせではない。会館で、一場面、演じてほしいとある。\n四月十九日、午後四時。持ち物はこの返事と、用意した台詞。\n日付の下に、薄い鉛筆の線が引いてあった。')
l('shop-4', 'shop-5', 'shop-6')
show('xia-admits', '夏禾', 'serious', 'right', 'change')
l('shop-7')
n('letter-face', '昨天吃馒头时，她坐得离许野很近，还替他捡过掉下去的笔。那封没拆的信，就在围裙口袋里。\n我看向杯口，想起她昨晚那句“等你忙完”。她却把信往我手下推了推。\n纸角硌到掌心，是真的。', '昨日、饅頭を食べたとき、彼女はイエのそばに座り、落ちた鉛筆まで拾っていた。開けていない手紙は、そのエプロンにあったのだ。\nカップの縁を見た僕の手の下へ、彼女がもう一度、紙を押した。\n角が掌に当たった。')
l('shop-8', 'shop-9')
n('letter-not-help', '我把手从信上拿开。纸面多了一点掌心的汗。\n她张了张嘴，没念，先问我中午有没有空。问得很慢，跟平常催我吃饭的口气不一样。\n我说有。她把信折好，折了两次才对齐。', '手を離すと、紙に掌の汗が少し移っていた。\n彼女は口を開けたが、読まずに、昼、空いてる、と聞いた。いつも食事を急かす声とは違って、ゆっくりだった。\n空いてる、と答える。彼女は手紙を畳み、二度目で端をそろえた。', quiet)
show('letter-xia-off', '夏禾', 'serious', 'right', 'hide')
bg('letter-close', 'audition-letter')
n('letter-own', '信封下面是她自己誊的台词稿。末页写着名字，横竖收得端正。\n她寄报名信的时候，我不知道。等回信的这一周，我也不知道。\n我把信还给她，让她自己装进布袋。', '封筒の下には、彼女が書き写した台詞があった。最後の頁には、名前がきちんと書いてある。\n応募したことも、返事を待った一週間のことも、僕は知らなかった。\n手紙を返すと、彼女は自分で袋へ入れた。')

scene = 3
bg('hall', 'theatre-complete', one)
n('hall-time', '下午两点，礼堂的侧门开着。\n刘叔早晨带来了备用钥匙，许野把几只锁摆在桌上，边上压着昨夜那张“别动”。我们没有找到第二块深色接木。\n他远远看见夏禾，就举起了新改的稿纸。', '午後二時、集会所の脇の戸は開いていた。\nリウさんが朝、予備の鍵を持ってきて、イエは錠を卓に並べていた。昨夜の「触らないで」も残っている。焦げ茶の継ぎ木は、見つからなかった。\nホーに気づくと、彼は書き直した紙を掲げた。', music('tam-atelier', .4))
show('hall-ye', '许野', 'smile', 'left')
show('hall-xia', '夏禾', 'serious', 'right')
l('hall-1')
n('hall-paper', '许野把稿纸分成两份，多出的那一份递给我。夏禾没有接。\n她把布袋放到一把结实的椅子上。拉带扣住了手指，她解开，又把袋口压平。\n我拿着稿子，等她说。', 'イエは原稿を二つに分け、余りを僕によこした。ホーは受け取らない。\n丈夫な椅子に袋を置く。紐が指にかかり、ほどいてから、袋の口を平らに押さえた。\n原稿を持ったまま、彼女が話すのを待った。', quiet)
l('hall-2', 'hall-3', 'hall-4')
n('hall-pauses', '许野把举着的手放下了。稿纸的右下角，是他新补的半页，铅笔字比前面深。\n夏禾看着那半页，没有把眼睛移开。\n门外传来刘叔清嗓子的声音，谁也没出去招呼。', 'イエの手が下がった。右下には新しい半頁が足してあり、前より濃い鉛筆で書かれている。\nホーはそこから、目をそらさなかった。\n外でリウさんが咳払いをしたが、誰も出ていかなかった。')
show('ye-hurt', '许野', 'serious', 'left', 'change')
l('hall-5', 'hall-6', 'hall-7', 'hall-8')
n('hall-answer', '那声“嗯”很轻，落下来却没有改口。\n许野低头，把她那份稿子收回去。一张纸粘住了另一张，他慢慢分开，没有揉。\n我差点伸手替他整理。手指动了一下，仍拿着自己的那份。', 'うん、という声は小さかったが、そのあと、言い直さなかった。\nイエは彼女の原稿を引き取った。二枚がくっついていて、ゆっくり離す。丸めはしない。\nつい、そろえてやりかけた。指だけ動いて、僕の分を持ったまま止まった。')
l('hall-9', 'hall-10')
n('hall-seat', '许野去门口跟刘叔说明。没说多久，门外的脚步声便走向库房。他们还有钥匙要核对。\n夏禾仍站在椅子旁，嘴角动了动。那是她遇到尴尬时常有的样子，像要先笑一下，才好继续说话。\n我把椅子往她那边挪了半步。', 'イエが戸口でリウさんに事情を話した。少しして、足音は倉庫へ向かった。鍵の確認は、まだある。\n椅子のそばのホーは、口元を動かした。気まずいとき、話を続ける前に一度笑おうとする、あの癖だった。\n椅子を、彼女のほうへ少し寄せた。')
l('hall-11', 'hall-12')
n('before-choice', '她坐下，把信放在膝上。那张票还在我上衣口袋里，纸比前天软了。\n我想陪她把台词念完，也得去问许野，今天的排练怎么办。\n两个人都没有催我。库房门被风轻轻推了一下。', '彼女は腰を下ろし、膝に手紙を置いた。僕の上着には、あの券がある。一昨日より柔らかくなっていた。\n彼女の台詞を聞きたかったし、今日の稽古をどうするか、イエとも話したかった。\nどちらも急かさない。風が、倉庫の戸を少し動かした。')
const choice = add('support-choice', 'choice', { choices: ['先陪夏禾读一遍', '先和许野调整排练'], localizations: { ja: { choices: ['先にホーの台詞を聞く', '先にイエと稽古の予定を相談する'] } } })
previous = undefined
show('a-hide-ye', '许野', 'serious', 'left', 'hide')
l('a-1', 'a-2')
n('a-eight', '她抬眼看我，鼻音里漏出一点笑。还没笑完，又去摸那封信的折角。\n我从口袋里取出票，摊在她的信旁。正面是我的名字，背面的勾仍在。\n夏禾看了一会儿，没伸手剪它。', '彼女は顔を上げ、小さく鼻で笑った。笑いきらないうちに、手紙の折り目へ戻る。\n券を出して、手紙のそばへ広げた。表には僕の名、裏にはあの印。\nしばらく見ていたが、切り取りはしなかった。')
l('a-3', 'a-4')
const aTail = previous!
edges.push({ id: 'pc2-choose-a', source: choice, target: 'pc2-a-hide-ye', sourceHandle: 'choice-0', label: '先听试演', animated: true })
previous = undefined
show('b-hide-xia', '夏禾', 'serious', 'right', 'hide')
show('b-ye-alone', '许野', 'serious', 'left', 'change')
n('b-sleeve', '许野在库房里，把原先要当铜像的卷布放回架子。试了两次，才塞进原来的空当。\n我帮他托了一下。他没有说谢谢，只把空出来的手在裤子上擦了擦。\n外面的夏禾在轻声念词，隔着门，听不清。', '倉庫で、イエは像にするはずの布を棚へ戻していた。二度試して、元の隙間へ収める。\n下から支えると、礼は言わず、空いた手をズボンで拭いた。\n外でホーが台詞を読んでいる。戸越しには、言葉までは聞き取れなかった。')
l('b-1', 'b-2', 'b-3')
n('b-stay', '他坐在空木箱上，慢慢把鞋带重新系好。我站着等，没替他把话接成祝福。\n系完以后，他抬头看了我一眼，像刚想起还有观众这一回事。', '空の木箱に座り、イエは靴紐を結び直した。立って待ち、彼の言葉を、お祝いには変えなかった。\n結び終えて、こちらを見る。客席のことを、今思い出したような顔だった。')
l('b-4')
const bTail = previous!
edges.push({ id: 'pc2-choose-b', source: choice, target: 'pc2-b-hide-xia', sourceHandle: 'choice-1', label: '先谈排练', animated: true })
previous = undefined
show('merge-xia', '夏禾', 'serious', 'right')
for (const tail of [aTail, bTail]) edges.push({ id: `${tail}-merge`, source: tail, target: 'pc2-merge-xia', animated: true })
show('merge-ye', '许野', 'normal', 'left')
n('merge-room', '回到台前，许野把两份稿子放到一起。他把铅笔递给夏禾，让她在角上写个新的排练日。\n她停了一下，没有随手写“改天”。先问他明天下午在不在。\n他点了头。', '舞台の前で、イエは二人分の原稿を重ねた。鉛筆をホーへ渡し、新しい稽古の日を書いてほしいという。\n彼女は適当に「また今度」とは書かず、明日の午後はいる、と先に聞いた。\n彼はうなずいた。')
l('merge-1', 'merge-2', 'merge-3')
n('merge-date', '她在原稿角上写了明天的日期，又写“三点”。许野把纸折进去，没再把那一角露出来。\n今天空下的那一段时间，他还要自己想办法用。\n我看着他去取库房清单，第一次没跟过去。', '彼女は明日の日付と「三時」を書いた。イエはその角を内側に折った。\n今日、空いてしまった時間は、自分で使い直すしかない。\n倉庫の目録を取りに行く彼を見送って、今日はついていかなかった。')
l('merge-4', 'merge-5', 'merge-6')

scene = 4
show('read-ye-away', '许野', 'normal', 'left', 'hide')
n('read-book', '夏禾从袋里拿出一本薄薄的《海鸥》，折角在最后一幕。\n许野写的是雕刻家，她准备的是妮娜。不是同一个人，连想去的地方也不一样。\n她把书放下，站到那扇画着海的假窗旁。', '袋から出した薄い本は、チェーホフの『かもめ』だった。最後の幕に折り目がある。\nイエが書いているのは彫刻家で、彼女が用意したのはニーナ。同じ人物ではないし、行きたい場所も違う。\n本を置き、海の描かれた偽物の窓へ立った。', music('maou-piano12', .32))
l('read-1')
n('nina-context', '我只翻过几页。妮娜受过伤，也演得不好，到了这里，仍得赶路，仍要演下去。\n夏禾没有解释这一大段。她先整理呼吸，把刚才想挤出来的笑收了回去。\n我坐到台阶上，手里没有拿工具。', '何頁かしか読んでいない。ニーナは傷つき、演技もうまくいかなかった。それでも、まだ旅をして、演じ続ける。\nホーは長く説明せず、息を整えた。さっき作りかけた笑みは、もうなかった。\n僕は舞台の段へ座った。手には道具を持っていない。')
l('read-2')
n('read-effort', '“演员”两个字，她念得很重，肩膀也跟着抬起来。念完以后，嘴唇还停在那里，像等一句判定。\n我没马上开口。她先松下肩膀，把那句话小声重念了一遍，只念给自己听。', '女優、というところで、声も肩も持ち上がった。読み終えても、口元はその形のまま、判定を待つように止まった。\nすぐには何も言わなかった。彼女は自分で肩を下ろし、小さく、もう一度だけ読んだ。自分に聞かせる声だった。')
l('read-3', 'read-4', 'read-5')
n('read-hands', '她没有抱什么东西，两只手却一直并得很紧。\n我想起昨天下午的卷布，自己怎么也迈不动的那一步。她也许并不需要我告诉她该怎样迈。\n手指慢慢分开，她把一只手放进了围裙口袋。', '何も抱えていないのに、両手はずっと、固くそろっていた。\n昨日、布を抱えて、一歩も動けなかったことを思い出す。彼女に、その一歩を教えられるわけではなかった。\n指がゆっくり離れ、片手がエプロンのポケットへ入った。')
l('read-6')
n('read-own-fear', '许野在库房里挪东西，椅脚短促地响了一下。\n我忽然想，往后别处响起这样的声音，她可能就在那边回头。这里再有人叫她，也未必能听见。\n我原先准备好的“那就去试试”，一下变得很轻。', '倉庫で物を動かす音がして、椅子の脚が短く鳴った。\nいつか、別の場所であの音がして、彼女はそちらへ振り返るのかもしれない。ここから名前を呼んでも、もう届かないほど遠くで。\n用意していた、受けてみれば、という言葉が、急に頼りなくなった。', quiet)
l('read-7')
n('read-honest', '说出来以后，台上没有立刻变得好过。\n夏禾低头，手指掐着信封那条破边。我把手伸过去，她却将信拿回了自己身前。\n她没有来安慰我。过了一会儿，她抬起头。', '口に出しても、舞台がすぐ楽になるわけではなかった。\nホーは目を伏せ、封筒の破れた端をつまんでいた。手を伸ばすと、手紙を自分の胸元へ引き戻した。\n慰めには来なかった。少しして、自分で顔を上げた。')
l('read-8', 'read-9')
n('leave-hall', '她重新系好围裙，把书压在布袋最上面，又摸了一次回信。\n许野送到侧门，替她扶住那扇总往回弹的门。他没再问结果，也没有说一定能行。\n夏禾朝他点点头，先跨了出去。', '彼女はエプロンの紐を結び直し、袋の一番上に本を入れ、もう一度、手紙を確かめた。\nイエは脇の戸を、跳ね返らないよう押さえていた。結果も聞かず、きっとうまくいくとも言わなかった。\nホーが彼にうなずき、先に敷居をまたいだ。', music('maou-healing15', .43))

scene = 5
show('corridor-hide-xia', '夏禾', 'serious', 'right', 'hide')
bg('corridor', 'audition-corridor')
n('corridor-clock', '文化站比我想的近。我们特意走慢，三点四十还是到了。\n走廊里一排木椅，靠里头的门开着半扇。有人在试钢琴，只按了几个分开的音，随后停住。\n夏禾在那扇半开的门前站了一会儿，退回到我身边。', '会館は思ったより近く、わざとゆっくり歩いたのに、三時四十分には着いた。\n廊下には木の椅子が並び、奥の戸は半分開いている。中でピアノの音がいくつか鳴り、それから止んだ。\nホーは戸の前に少し立ち、僕のそばへ戻ってきた。', quiet)
show('corridor-xia', '夏禾', 'serious', 'right')
l('door-1', 'door-2', 'door-3')
n('corridor-listen', '我把已经张开的嘴合上，向旁边让了一点，给她留出那把椅子。\n她没坐。脚尖磨了磨地上的砖缝，像在找一块不晃的地方。\n我也没坐。听她说完。', '開きかけた口を閉じ、少し脇へ寄って、椅子を空けた。\n彼女は座らず、煉瓦の目地をつま先でこすった。足元の揺れない場所を探すように。\n僕も、まだ座らなかった。最後まで聞いた。')
l('door-4', 'door-5')
n('corridor-small-laugh', '她的气从鼻子里呼出来，一声短短的笑，又马上低下头。\n我想起许野刚才把两份稿子收回去的样子，自己也笑不大出来。\n这笔账要真传到他那里，大概得还很久。', '鼻から息が抜け、小さく笑ってから、彼女はまたうつむいた。\nさっきイエが二人分の原稿をしまった手つきを思い出し、僕も大きくは笑えなかった。\nあの掛けが本人に伝わったら、しばらく返せそうにない。')
l('door-6', 'door-7')
n('corridor-date', '她从袋子里摸出车次表。折缝又白了一点，六号和回程那两个勾挤在同一角。\n我以为她要把日期挪开，手指已经往铅笔那里去。她用纸边碰了碰我的手背，没让我拿。', '時刻表が袋から出てきた。折り目は少し白くなり、六日と帰りの印が、同じ隅に寄っている。\n日を変えるのかと思い、鉛筆へ手をやる。紙の端で、彼女が僕の手の甲を軽く叩いた。')
l('door-8', 'door-9')
show('corridor-xia-soft', '夏禾', 'normal', 'right', 'change')
n('paper-turn', '她把报名稿翻到背面，在空白处写下今天的日期。下面是：我去试演，是我自己想去。\n写完后，她读了一遍，没加“不要后悔”。\n我从旁边看着，等她写名字。', '応募原稿を裏返し、余白に今日の日付を書いた。その下には、審査へ行く。自分が行きたいから、とある。\n読み直しても、後悔しない、といった言葉は足さなかった。\n横で、名前を書くのを待った。', paper)
l('paper-1', 'paper-2', 'paper-3')
n('paper-pause', '那张纸很薄。只要折起来，就能跟我口袋里的票放在一起。\n我有一瞬间想把它当成一个不会再变的答复。夏禾却还捏着纸角，没有给我。\n她像是知道我正想省掉哪一步。', '薄い紙だった。畳めば、ポケットの券と一緒に入る。\nもう変わらない返事として、しまっておきたくなった。けれどホーは、まだ紙の角をつかんでいる。\n僕がどこを省こうとしたのか、分かっているようだった。')
l('paper-4', 'paper-5')
n('paper-name', '她把“夏禾”写得比上面的字都大，最后一笔收得很快，差点把纸划破。\n我接过来，没有折到名字上。口袋小了一点，我便让纸边露在外面。\n她瞥见那一角，终于不用手再去按它。', '上の字より大きく、夏禾、と書いた。最後の線は速く、紙を破りそうだった。\n受け取り、名前に折り目をつけないよう畳む。ポケットは少し小さく、端が外へ出た。\n彼女はその端を見ると、もう押さえには来なかった。')
l('end-1', 'end-2')
n('door-opens', '门里的人出来，核对了回信，请她在下一次开门时进去。没有观众席，也不卖票。\n夏禾把一边袖口翻平。走到门前时，她又回过头，朝那排候场椅看了一眼。\n我已经挑了一把坐下。', '中から人が出て、手紙を確かめ、次に戸が開いたら入るよう伝えた。客席もなく、券も売っていない。\nホーは袖口を直し、戸の前で一度、椅子の列を振り返った。\n僕はもう、一脚選んで座っていた。')
l('door-10', 'door-11', 'end-3')
show('xia-enters', '夏禾', 'normal', 'right', 'hide')
n('wait-seat', '门在她身后合拢，里面先静了一会儿，才有人挪开一把椅子。\n我没有站起来。把露在口袋外面的纸角抹平，又放开。\n四点的钟声从窗外过来。还有些时候要等。', '背後で戸が閉まり、中はしばらく静かだった。やがて、椅子を引く音がする。\n立ち上がらず、ポケットから出た紙の端を伸ばして、手を離した。\n外から四時の鐘が聞こえた。まだ、待つ時間があった。', music('maou-healing15', .36))

scene = 6
bg('studies', 'restoration-studies')
n('outside-cut', '另一间房里，陆青把台灯向下挪了一点。\n委托人送来的旧照片摊在左边，闻砚留下的底稿放在右边。她原先按照片整理缺失的细节。\n这一天，轮到了画中女孩的嘴角。', '別の部屋で、ルー・チンが卓上灯を少し下げた。\n左には依頼人から届いた古い写真、右にはウェン・イエンの下絵。欠けた細部は、写真を参照して整理してきた。\nその日は、絵の少女の口元を見る番だった。', quiet)
n('outside-two', '照片里的女孩笑着。底稿里，她没有笑。\n同样的发梢，同样系法的围裙，纸边却都没写日期。两张资料，谁也没有替另一张标出“画错”。\n陆青把笔放回水罐边，先抽出了记录本。', '写真の少女は笑っていた。下絵の少女は、笑っていない。\n髪の先も、エプロンの結び方も同じだが、どちらにも日付がない。間違いだと、一方を退ける書き込みもなかった。\nルー・チンは筆を水差しのそばへ置き、先に記録帳を取った。')
n('ending', '她写下：“面部补色暂缓。待查底稿。”\n写完，又在“原貌”下面轻轻点了一下。那两个字没有被划掉，也没有变得更清楚。\n桌上的两张纸，仍并排放着。', '「顔の補彩は保留。下絵を要確認」と書いた。\n書き終えてから、原状、という言葉の下を、小さく突いた。消したわけでも、意味がはっきりしたわけでもない。\n二枚の紙は、並んだまま残った。')

export const PAINT_CHAPTER_TWO_SOURCES = [{ nodeId: 'pc2-read-1', author: 'Anton Chekhov', title: 'The Sea-Gull', url: 'https://www.gutenberg.org/cache/epub/1754/pg1754-images.html', use: '妮娜关于自己仍是演员的极短语句为自译，试演与角色关系为原创；没有借用现成中文译文或商业Galgame演出。' }] as const
export const PAINT_CHAPTER_TWO = {
  id: PAINT_PROLOGUE.id, title: PAINT_PROLOGUE.title, chapterTitle: '第二章 · 她今天不想笑',
  description: '那把椅子失去了补痕，海景却被补得更完整。一次小戏、一张未剪口的票、一封拆晚的试演回信，让程见、夏禾与许野重新商量各自的明天。原创文学幻想 · 序章至第二章 · 中文字幕 / 固定角色日语配音。',
  cover: PAINT_PROLOGUE.cover, characters: PAINT_PROLOGUE.characters, graph: { nodes, edges } as StoryGraph,
} as const
