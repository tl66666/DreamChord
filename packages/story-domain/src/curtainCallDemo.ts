import type { StoryGraph, StoryNode, StoryEdge, StoryNodeType } from './types.js'
import { voiceTextHash } from './voiceDirection.js'

type Role = '许栀' | '唐棠' | '林澈'
const root = '/assets/curtain-call'
const nodes: StoryNode[] = [], edges: StoryEdge[] = []
let scene = 1, previous: string | undefined
function add(id: string, type: StoryNodeType, data: Record<string, unknown>) {
  nodes.push({ id, type, position: { x: scene * 480, y: nodes.length * 95 }, data: { ...data, sceneGroupId: `curtain-scene-${scene}`, sceneTitle: ['被划掉的一句', '上台以前', '空下来的礼堂', '下一次见面', '六点的车站'][scene - 1], sceneCode: `1-${scene}` } })
  if (previous) edges.push({ id: `${previous}-${id}`, source: previous, target: id, animated: true })
  previous = id
  return id
}
function note(id: string, text: string, ja: string, extra: Record<string, unknown> = {}) {
  return add(id, 'subtitle', { role: '旁白', text, localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } }, ...extra })
}
function speech(id: string, role: Role, text: string, ja: string, extra: Record<string, unknown> = {}): StoryNode {
  const slug = ({ 许栀: 'zhi', 唐棠: 'tang', 林澈: 'lin' } as const)[role]
  return { id, type: 'dialogue', position: { x: 0, y: 0 }, data: { role, text, localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } }, voiceTracks: {
    zh: { url: `/assets/audio/curtain-call/${id}-zh.ogg`, textHash: voiceTextHash(text), profileId: `curtain-voice-${slug}` },
    ja: { url: `/assets/audio/curtain-call/${id}-ja.ogg`, textHash: voiceTextHash(ja), profileId: `curtain-voice-${slug}` },
  }, ...extra } }
}
function line(id: string, role: Role, text: string, ja: string, extra: Record<string, unknown> = {}) { return add(id, 'dialogue', speech(id, role, text, ja, extra).data) }
function bg(id: string, name: string) { add(id, 'background', { backgroundId: `${root}/${name}.webp` }) }
function show(id: string, characterId: Role, expression: 'normal' | 'sad' | 'smile', position: 'left' | 'right' | 'center', action = 'show') { add(id, 'character', { characterId, expression, position, action }) }
const music = (track: string, volume = .55) => ({ bgm: { action: 'play', url: `/assets/audio/curtain-call/${track}.ogg`, volume, fadeInMs: 1600, fadeOutMs: 1400 } })

bg('backstage', 'backstage')
note('crossed-out', '离毕业晚会结束还有十分钟，许栀划掉了谢幕词的最后一句。\n\n“明年，也一起站在这里吧。”', '卒業公演が終わるまで、あと十分。許栀は閉会の言葉の最後の一行に、線を引いた。\n\n「来年も、一緒にここに立とう」', { audio: music('backstage') })
show('zhi-start', '许栀', 'normal', 'center')
line('opening-1', '林澈', '昨天还说这句写得好，今天就不要了？', '昨日は、この一行がいいって言ってたのに。')
line('opening-2', '许栀', '昨天是昨天。我明早六点的车，明年谁知道在哪儿。', '昨日は昨日。明日の朝六時には電車だよ。来年なんて、どこにいるかわからない。')
note('known-plans', '她去外省的设计事务所上班，我留下读研。去向早就定了。\n我们连哪天退宿都聊过，唯独没聊过，离开学校以后还要不要见面。', '彼女は他省のデザイン事務所へ。僕は大学院に残る。進路はとっくに決まっていた。\n寮を出る日まで話したのに、卒業したあとも会うのか、それだけは話していない。')
show('tang-start', '唐棠', 'smile', 'left')
show('zhi-right', '许栀', 'normal', 'right')
line('opening-3', '唐棠', '二位，笔先放下。主持人还没毕业，稿子快被你们改退休了。', 'お二人さん、いったんペンを置こう。司会はまだ卒業してないのに、原稿のほうが先に引退しそう。')
line('opening-4', '林澈', '你是来催场，还是来看热闹？', '呼びに来たの？　それとも、見に来ただけ？')
line('opening-5', '唐棠', '都不耽误。还有七分钟，谁再改谁请夜宵。', '両方。あと七分。次に直した人が、夜食おごりね。')
note('familiar-paper', '唐棠把两支话筒并排放好。红笔沿着纸边滚过来，被许栀接住。\n大一迎新晚会，我忘词，也是她把稿子推到我眼前。那次以后，我们搭了四年的档。', '唐棠がマイクを二本並べる。転がってきた赤ペンを、許栀が受け止めた。\n一年生の歓迎公演で言葉が飛んだときも、原稿を差し出してくれたのは彼女だった。それから四年、ずっと二人で組んできた。')
line('opening-6', '许栀', '看什么？这次我可不给你提醒。', '何？　今日は助け舟、出さないからね。')
line('opening-7', '林澈', '那你别拿走稿子。你知道我没背下来。', 'じゃあ原稿、持っていかないで。覚えてないの、知ってるだろ。')
show('zhi-small-smile', '许栀', 'smile', 'right')
line('opening-8', '许栀', '四年了，还是这个出息。', '四年たっても、そこは変わらないね。')
note('laugh-ends', '她笑了一下，拧开水瓶。瓶盖搁在那道红线上。\n台上的合唱唱到最后一段，门缝里漏进来一小片灯光。', '彼女は少し笑って、水のふたを開けた。ふたを、あの赤い線の上に置く。\n舞台の合唱は最後の節に入っていた。扉の隙間から、細い光が差し込む。')

scene = 2
show('tang-leave', '唐棠', 'normal', 'left', 'hide')
show('zhi-alone', '许栀', 'normal', 'center')
note('before-stage', '唐棠去确认灯光。许栀把稿子翻过来，背面密密麻麻，全是排练时随手记的东西。\n“左边话筒偏低”“别踩线”“林澈这里容易忘”。最后一条，昨天才写。', '唐棠が照明を確認しに行く。原稿の裏には、稽古のメモがびっしりあった。\n「左のマイクは低い」「コードを踏まない」「ここで林澈が忘れがち」。最後の一つは、昨日の字だ。', { audio: music('unsaid', .45) })
line('before-1', '林澈', '你到了那边，安顿好给我发个消息。', '向こうに着いて、落ち着いたら連絡して。')
line('before-2', '许栀', '然后呢？', 'それから？')
line('before-3', '林澈', '什么然后？', 'それからって？')
show('zhi-question', '许栀', 'sad', 'center')
line('before-4', '许栀', '你回一个“收到”，我回一个表情。再往后，谁先忙起来，就不说了。', '君が「了解」って返して、私がスタンプを送る。そのうち、どっちかが忙しくなって、そこで終わり。')
note('phone', '我掏出手机，又放回口袋。\n她说的那段对话，我们还没发生过，我却已经知道自己会用哪个表情。', '携帯を出しかけて、ポケットに戻した。\nまだ交わしてもいないやりとりなのに、自分がどのスタンプを使うかまでわかってしまった。')
line('before-5', '林澈', '我不是不想找你。我怕你刚开始工作，没空听这些。', '連絡したくないわけじゃない。仕事が始まったばかりで、そんな暇ないかと思って。')
line('before-6', '许栀', '那也让我自己说没空啊。你每次都提前替我想好了。', 'だったら、忙しいって私に言わせてよ。いつも先に、私の返事まで考えるんだから。')
note('not-stay', '她把瓶盖拧回去，没有看我。\n我终于明白，她不是在等我说“别走”。那份工作，是她改了十几遍作品集才争取来的。', 'ふたを閉めた彼女は、こちらを見なかった。\n「行くな」を待っているわけじゃない。あの仕事は、何度も作品集を直して、自分でつかんだものだ。')
line('before-7', '林澈', '我想见你的。毕业以后也想。', '会いたいよ。卒業してからも。')
line('before-8', '许栀', '这句话，你排练的时候怎么从来没说过？', 'その台詞、練習のときは一度も言わなかったね。')
note('cue', '门被敲了两下。唐棠探进半张脸，指指手表，又指指我手里的稿子。\n还有一分钟。许栀把红笔递给我。那句话还看得清。', '扉が二度、鳴った。顔をのぞかせた唐棠が、腕時計と、僕の原稿を指す。\nあと一分。許栀が赤ペンを渡してくれた。線の下の文字は、まだ読めた。')
line('choice-line', '许栀', '最后这句，你来定。不过下了台，还得算数。', '最後の一行は、君が決めて。でも、舞台を降りても覚えていてね。')
const choice = add('curtain-choice', 'choice', { choices: ['留下邀请：“下次见面的日子，我们一起定。”', '改成祝福：“愿你去的地方，有你想过的生活。”'], localizations: { ja: { choices: ['約束を残す。「次に会う日は、二人で決めよう」', '送り出す言葉に。「君の望む暮らしが、その先にありますように」'] } } })

previous = undefined; scene = 3
note('invitation-speech', '我把那行字改了，推到她面前。\n上台时，许栀把我的话筒调高了一点。最后那句，我们一人念了一半。\n掌声响起来，她还握着稿子的另一边。', '一行を書き直して、彼女に見せた。\n舞台に上がると、僕のマイクを少し上げてくれた。最後の一文は、半分ずつ読んだ。\n拍手が響いても、彼女は原稿の端を持ったままだった。', { audio: { bgm: { action: 'stop', fadeOutMs: 1300 } } })
edges.push({ id: 'choose-invitation', source: choice, target: 'invitation-speech', sourceHandle: 'choice-0', label: '留下邀请', animated: true })
bg('stage-after', 'stage')
show('zhi-stage', '许栀', 'smile', 'center')
note('empty-stage', '散场后，礼堂空下来。唐棠去关最后一排灯，我们留下收话筒。\n许栀绕了半天线，越绕越乱。我接过去，她很自然地松了手。', '客が帰り、ホールは静かになった。唐棠が後ろの照明を落とす間、二人でマイクを片づけた。\n許栀が巻いたコードは、どんどん絡まっていく。僕が手を出すと、いつものように任せてくれた。', { audio: music('invitation') })
line('invitation-1', '许栀', '所以，下一次是什么时候？别又说“有空”。', 'それで、次はいつ？　「時間ができたら」は、なしね。')
line('invitation-2', '林澈', '十月假期，我去找你。车票我提前买，住的地方我自己订。', '十月の休みに、そっちへ行く。切符は早めに取るし、泊まる所も自分で探す。')
line('invitation-3', '许栀', '安排得这么周全。就没什么要问我的？', 'ずいぶん用意がいいね。私に聞くことは？')
line('invitation-4', '林澈', '你愿不愿意，带我去吃你找到的第一家好吃的店？', 'そっちで最初に見つけた、おいしい店に連れていってくれる？')
show('tang-last', '唐棠', 'smile', 'left')
show('zhi-last-right', '许栀', 'smile', 'right')
line('invitation-5', '唐棠', '成了没？我要关灯了。要不你俩把这段也写进交接表？', '話、まとまった？　消灯するよ。続きも引き継ぎノートに書いとく？')
scene = 4
bg('campus-night', 'campus')
show('tang-home', '唐棠', 'normal', 'left', 'hide')
show('zhi-walk', '许栀', 'smile', 'center')
note('campus-walk', '我们从侧门出来。她拖着那袋没用完的彩带，我拿着话筒箱，像每一次晚会结束。\n走到宿舍岔路，她没有立刻拐弯。', '脇の扉から出た。彼女は余ったリボンの袋、僕はマイクのケース。公演のあとは、いつもこうだった。\n寮へ向かう分かれ道で、彼女が足を止めた。')
line('invitation-6', '许栀', '十月还早。明天送我去车站吧，路上就能先请你吃早饭。', '十月は、まだ先だね。明日、駅まで送ってよ。まずは途中で、朝ごはんおごるから。')
line('invitation-7', '林澈', '好。还有，夜宵是我请。那一笔是我改的。', 'うん。それと夜食は、僕のおごり。最後に直したの、僕だから。')
note('ending-invitation', '她笑着把彩带袋塞给我，腾出手，在手机日历上圈了一个日期。\n不是明年，也不是某个有空的以后。\n十月一日。旁边还写着：先问许栀想吃什么。\n\n——结局一 · 下一次见面——', '彼女は笑ってリボンの袋を渡すと、空いた手でカレンダーを開き、日付に印をつけた。\n来年でも、いつか暇になった日でもない。\n十月一日。メモは、「まず許栀に、何が食べたいか聞く」。\n\n——結末一・次に会う日——')

previous = undefined; scene = 5
note('blessing-speech', '我写下一句祝福。她看过以后，在“你”字旁边加了一个小小的“们”。\n那是说给所有毕业生的话。\n上台前，我拉住了她的衣袖：“明早，我送你。”她点点头。', '送り出す言葉を書いた。彼女はそれを読み、「君」を「みんな」に直した。\n卒業する全員への言葉になった。\n舞台に出る前、袖をそっと引いた。「明日の朝、送るよ」。彼女はうなずいた。', { audio: { bgm: { action: 'stop', fadeOutMs: 1300 } } })
edges.push({ id: 'choose-station', source: choice, target: 'blessing-speech', sourceHandle: 'choice-1', label: '改成祝福', animated: true })
bg('station-morning', 'station')
show('zhi-station', '许栀', 'normal', 'center')
note('morning-platform', '早上五点五十分。我把热豆浆放进她行李箱侧袋，拎手上还系着昨晚剩下的一截彩带。\n这一次，没有稿子，也没有人替我们报幕。', '朝五時五十分。温かい豆乳を、彼女のスーツケースの横ポケットに入れた。持ち手には、昨夜のリボンが少しだけ残っている。\n今日は原稿も、僕らを紹介してくれる人もいない。', { audio: music('station', .5) })
line('station-1', '许栀', '你昨晚那句祝福，我听见了。', '昨日の、送り出す言葉。ちゃんと聞いたよ。')
line('station-2', '林澈', '那句是给大家的。还有一句，只想跟你说。', 'あれは、みんなへの言葉。もう一つ、君にだけ言いたいことがある。')
note('train-door', '她停下拉箱子的手。车门还开着，站务员在远处看表。\n我没有再问她到了以后忙不忙。', '彼女の手が、持ち手の上で止まった。扉はまだ開いている。向こうで係員が時計を見た。\n忙しくなるかどうかは、もう聞かなかった。')
line('station-3', '林澈', '我喜欢你。不是因为今天要分别，才忽然喜欢的。', '好きだよ。今日、離れるから急に好きになったわけじゃない。')
show('zhi-station-sad', '许栀', 'sad', 'center')
line('station-4', '许栀', '你偏偏挑现在说。我马上要上车了。', 'どうして今なの。もう、乗らなくちゃいけないのに。')
line('station-5', '林澈', '嗯。我不是来要你留下的，也不是来要一个答案。就是不想再让你猜了。', 'うん。引き止めに来たんじゃない。返事をもらいに来たわけでもない。ただ、もう察してもらうのは、やめたかった。')
note('boarding', '许栀低头摸了摸那截彩带，提着箱子上了车。\n隔着车窗，她拿出手机。我的屏幕几乎同时亮起来。', '許栀はリボンに触れ、ケースを持って乗り込んだ。\n窓の向こうで携帯を出す。僕の画面も、ほとんど同時に光った。')
show('zhi-window-smile', '许栀', 'smile', 'center')
line('station-6', '许栀', '到了给你打电话。不是报平安，是还有话没说完。', '着いたら電話する。無事に着いたって報告だけじゃなくて。まだ、話の続きがあるから。')
note('ending-station', '列车开走以后，我才发现自己还拿着昨晚的稿子。\n最后一行已经改好，背面那条“林澈这里容易忘”却还在。\n我把纸折起来，放进贴着手机的那个口袋。\n\n——结局二 · 话还没说完——', '列車が動き出してから、昨日の原稿を持ったままだと気づいた。\n最後の一行は直っていた。でも裏には、「ここで林澈が忘れがち」が残っている。\n紙を折って、携帯と同じポケットにしまった。\n\n——結末二・話の続き——')

export const CURTAIN_STARTER_ENDING = speech('your-first-line', '许栀', '那你呢？最后这一句，你想怎么写？', '君ならどうする？　最後の一行、何て書きたい？', { creatorStarter: true, audio: music('backstage') })
export const CURTAIN_CALL_DEMO = {
  id: 'dreamchord-curtain-call', title: '明日列车与未完的谢幕',
  description: '毕业晚会结束前，她划掉了“明年，也一起站在这里吧”。明早六点的列车，留给两位老搭档最后一次排练。约 5–8 分钟 · 两个结局 · 玩完写下你的第三种结局。',
  cover: `${root}/backstage.webp`, chapterTitle: '序章 · 六点以前的返场', graph: { nodes, edges } as StoryGraph,
  characters: [
    { slug: 'zhi', name: '许栀', description: '22 岁，设计专业毕业生，明早去外省入职。林澈搭档了四年的主持人。话说得轻，但不愿再替对方猜答案。', color: '#75698b', defaultSprite: `${root}/zhi-normal.png` },
    { slug: 'tang', name: '唐棠', description: '22 岁，毕业晚会舞台执行，二人的朋友。手拿场记板，嘴上催场，还是给他们留出了一分钟。', color: '#bc9561', defaultSprite: `${root}/tang-normal.png` },
    { slug: 'lin', name: '林澈', description: '22 岁，毕业生，留校读研。熟悉许栀所有提醒手势，却一直没说过稿子外的那一句。第一人称视角。', color: '#59758f', defaultSprite: `${root}/lin-normal.png` },
  ],
} as const
