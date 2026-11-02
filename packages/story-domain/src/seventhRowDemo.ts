import type { StoryGraph, StoryNode, StoryEdge, StoryNodeType } from './types.js'
import { voiceTextHash } from './voiceDirection.js'

type Role = '陆遥' | '程夏' | '陈屿'
const root = '/assets/seventh-row'
const nodes: StoryNode[] = [], edges: StoryEdge[] = []
let scene = 1
let previous: string | undefined
function add(id: string, type: StoryNodeType, data: Record<string, unknown>) {
  nodes.push({ id, type, position: { x: scene * 480, y: nodes.length * 95 }, data: { ...data, sceneGroupId: `row-scene-${scene}`, sceneTitle: ['最后一场', '缺掉的七秒', '第七排', '原声放映', '今晚的片尾'][scene - 1], sceneCode: `1-${scene}` } })
  if (previous) edges.push({ id: `${previous}-${id}`, source: previous, target: id, animated: true })
  previous = id
  return id
}
function note(id: string, text: string, ja: string, extra: Record<string, unknown> = {}) {
  return add(id, 'subtitle', { role: '旁白', text, localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } }, ...extra })
}
function line(id: string, role: Role, text: string, ja: string, extra: Record<string, unknown> = {}) {
  const slug = ({ 陆遥: 'luyao', 程夏: 'chengxia', 陈屿: 'chenyu' } as const)[role]
  return add(id, 'dialogue', { role, text, localizations: { ja: { text: ja, sourceHash: voiceTextHash(text) } }, voiceTracks: {
    zh: { url: `/assets/audio/seventh-row/${id}-zh.ogg`, textHash: voiceTextHash(text), profileId: `seventh-voice-${slug}` },
    ja: { url: `/assets/audio/seventh-row/${id}-ja.ogg`, textHash: voiceTextHash(ja), profileId: `seventh-voice-${slug}` },
  }, ...extra })
}
function bg(id: string, name: string) { add(id, 'background', { backgroundId: `${root}/${name}.webp` }) }
function show(id: string, characterId: Role, expression: 'normal' | 'sad' | 'smile', position: 'left' | 'right' | 'center', action = 'show') { add(id, 'character', { characterId, expression, position, action }) }
const music = (track: string, volume = .22) => ({ bgm: { action: 'play', url: `/assets/audio/seventh-row/${track}.ogg`, volume, fadeInMs: 1800, fadeOutMs: 1200 } })

bg('rain', 'cinema-rain')
note('opening', '我修好了那卷磁带。\n程夏听完，却说：“这不是我唱完以后说的话。”', 'あのテープの修復は終わった。\n聞き終えた彼女は言った。「歌のあと、私が言ったのは、これじゃない」', { audio: music('rain') })
note('rain-note', '白帆影院最后营业的夜晚，雨水顺着停映通知往下淌。通知写得太满，连明天都没有地方落款。\n我在门口收了伞。八年前，也是这样的雨。', '白帆映画館、最後の営業日。上映終了の貼り紙を雨が伝っていた。紙は文字で埋まり、明日の日付を書き込む余白もない。\n入り口で傘を閉じる。八年前も、こんな雨だった。')
show('luyao-door', '陆遥', 'normal', 'center')
line('door-1', '陆遥', '迟了十二分钟。以前你会说，是雨。', '十二分遅刻。昔なら、雨のせいだって言ったね。')
line('door-2', '陈屿', '这次是我出门晚了。', '今日は、家を出るのが遅くなった。')
line('door-3', '陆遥', '那进来吧。离关门，还有四十分钟。', 'じゃ、入って。閉館まで、あと四十分。')
note('door-note', '陆遥没有接我的伞。门边仍是那只掉漆的铁桶，里面已经有一把红伞。\n我认得伞柄上绕的白胶布。程夏总说，修过的东西比较不容易拿错。', '傘は受け取ってもらえなかった。扉の横には昔の、塗装の剥げたバケツ。赤い傘が一本、先に入っている。\n柄に巻いた白いテープを覚えていた。直した物なら、取り違えない。彼女の口癖だった。')

scene = 2
bg('booth', 'projection-room')
show('luyao-booth', '陆遥', 'normal', 'left')
show('chengxia-booth', '程夏', 'normal', 'right')
note('booth-note', '放映室里有热灯泡与潮木头的味道。程夏把一本蓝色笔记放在桌上，推开我带来的光盘。\n她没有我想象中那么憔悴。这个发现让我难堪。', '映写室は熱い電球と湿った木の匂いがした。彼女は青い手帳を置き、僕の持ってきたディスクを押しやった。\n思い描いていたほど、やつれてはいない。そのことを考えた自分が恥ずかしかった。', { audio: music('room') })
line('booth-1', '程夏', '先别放。你把哪一段修好了？', 'まだかけないで。どこを直したの？')
line('booth-2', '陈屿', '底噪、走音的带速，还有片尾那七秒空白。', 'ノイズと、テープの速度。それから最後の、七秒の空白。')
line('booth-3', '程夏', '七秒。我当年说话，倒是比现在利索。', '七秒か。昔の私、今より手短に話せたんだね。')
line('booth-4', '陆遥', '原带在这里。我爸贴的“坏带”，没扔。', '元のテープ、ここにある。父さんが「不良」って貼ったまま、捨てなかった。')
note('tape-note', '纸套背面写着日期。八年前，十月二十九日。\n我寄给程夏的那张光盘晚了三天。快递单的寄出地，却不是我声称被困住的小站。', 'ケースの裏に日付。八年前の、十月二十九日。\n僕がディスクを送ったのは三日後だった。送り状の発送元は、足止めされたと言い訳した小さな駅ではない。')
line('booth-5', '程夏', '你那天去面试了，对吧？', 'あの日、面接に行ってたんでしょう？')
line('booth-6', '陈屿', '嗯。车也没有停。我怕你以后不再找我。', 'うん。電車も止まってなかった。もう会ってもらえない気がして。')
show('chengxia-hurt', '程夏', 'sad', 'right')
line('booth-7', '程夏', '我后来找过你。你每次都问，我还在不在等。', 'そのあと、何度も連絡したよ。そのたびに、まだ待ってるのかって聞いたね。')
line('booth-8', '陆遥', '她问过你城里哪家面馆好吃。你回了三百字道歉。', '街でおいしい麺の店を聞かれて、三百字の謝罪を返してたね。')
note('booth-silence', '程夏低头笑了一下。\n灯泡响了一声。原来这么小的房间，也能让人找不到该站的位置。', '彼女はうつむいて、少し笑った。\n電球がかすかに鳴る。こんなに狭い部屋でも、立つ場所がわからなくなる。')
line('booth-9', '程夏', '带子呢？别再替我留白了。', 'テープ、聞かせて。もう、私の言葉を空白にしないで。')
note('playback', '我按下播放。\n十六岁的歌声晃了一下，走到最后一个音。椅脚摩擦地面，有人咳嗽。接着，是我剪掉过的声音。', '再生ボタンを押した。\n十六歳の歌声が揺れ、最後の音に届く。椅子を引く音。誰かの咳。そして、僕が切り取った言葉。', { audio: { bgm: { action: 'stop', fadeOutMs: 1000 } } })
line('tape-1', '程夏', '第七排，帮我放一下琴盒。我唱完了，谁也不用等啦。', '七列目、ギターケース置いといて。もう歌い終わったから、誰も待たなくていいよ。')
line('tape-2', '陆遥', '那我坐哪儿？', 'じゃあ、私はどこに座るの？')
line('tape-3', '程夏', '坐我旁边啊。你总不能一直站着。', '私の隣。ずっと立ってるつもり？')
note('seven-seconds', '七秒的空白。\n我把她唱完歌后，招呼朋友坐下的一小段话，换成了一个没有等到我的夜晚。\n好多年里，我竟也认真相信过那个版本。', '七秒の空白。\n歌い終えた彼女が、友達を隣に誘った短いやりとり。それを消して、僕を待ち続ける夜にした。\n何年もの間、僕自身さえ、その話を信じていた。')
line('booth-10', '陈屿', '当时导出光盘，我把这段删了。不是带子坏了。', 'ディスクにするとき、ここを消した。テープの故障じゃない。')
line('booth-11', '程夏', '我知道。蓝本上有我写的串场词。你忘了，我也有原稿。', '知ってた。この青い手帳に、曲間の言葉を書いてある。私にも原稿があるって、忘れてたね。')
line('booth-12', '陆遥', '我也听过原带。我以为，总有一天你会自己说。', '私も元のテープを聞いた。いつか、自分で言ってくれると思ってた。')
line('booth-13', '程夏', '结果你们俩替我保管了八年。我今天只是来拿回它。', 'それで二人して、八年も預かってたんだ。今日はね、それを返してもらいに来たの。')

scene = 3
bg('hall', 'auditorium')
show('hall-luyao', '陆遥', 'sad', 'left')
show('hall-chengxia', '程夏', 'normal', 'right')
note('hall-note', '我们走到观众席。第七排那张空椅子，坐垫仍用一根细绳拴着。\n它的弹簧在那年秋天就坏了。陆遥说，修座椅的人一直没来，后来大家便习惯了绕开它。', '客席へ降りる。七列目の空席は、今も細い紐で座面が縛ってあった。\nばねは、あの秋に壊れたまま。修理の人はとうとう来ず、みんな避けて座るようになったのだという。', { audio: music('hall') })
line('hall-1', '陈屿', '最后一场，要用这卷录音做片尾吗？', '最後の上映、この録音をエンドロールに使う？')
line('hall-2', '陆遥', '片子是我爸挑的，片尾他说让我自己定。', '映画は父さんが選んだ。最後に何を流すかは、私が決めていいって。')
line('hall-3', '程夏', '可以放原版。唱破的那个音也留下，我不想再修一遍十六岁。', '元のままなら、流していいよ。外した音も残して。十六歳の私を、もう直さなくていい。')
line('hall-4', '陆遥', '也可以不放。录一点今天的声音，雨声也行。', '流さなくてもいい。今日の音を録っても。雨の音とか。')
note('choice-note', '门外有人合起雨伞，踩着垫子上的水。最后一场的观众开始进来了。\n程夏把原带交给我，手却没有立刻松开。', '入り口で傘を畳む音。濡れたマットを踏む足音。最後の上映を見に来た客が入り始めた。\n彼女はテープを渡しながら、すぐには手を離さなかった。')
line('hall-5', '程夏', '这次先问我。你想怎么放？', '今度は、先に聞いて。どうしたい？')
const choice = add('last-show-choice', 'choice', { choices: ['放原带，请程夏自己介绍这段片尾', '保留原带，问她们愿不愿意录下今晚'], localizations: { ja: { choices: ['元のテープを、本人の言葉で紹介してもらう', '元のテープは残して、今夜の音を録らないか聞く'] } } })

previous = undefined; scene = 4
line('original-1', '陈屿', '放原版吧。介绍词，你来说。我去看电平。', '元のまま流そう。紹介は、君の言葉で。僕は音量を見てくる。', { audio: music('original') })
edges.push({ id: 'choose-original', source: choice, target: 'original-1', sourceHandle: 'choice-0', label: '原声放映', animated: true })
show('original-chengxia', '程夏', 'smile', 'right')
line('original-2', '程夏', '好。别把推子拉太高，那时候的我，嗓门挺大的。', 'うん。フェーダー上げすぎないでね。あの頃の私、声が大きいから。')
note('original-note', '银幕熄灭后，程夏站到了过道。她没有讲那个失约的人，只说自己曾在这里唱过一首没练熟的歌。\n十六岁的录音从音箱里传出来。唱破的地方，后排有人轻轻笑了。她也笑。', 'スクリーンが暗くなると、彼女は通路へ出た。約束を破った誰かの話はしなかった。ただ、ここで一度、練習不足の歌を歌ったと。\n十六歳の声が響く。音を外したところで、後ろの客が小さく笑った。彼女も笑った。')
line('original-3', '陆遥', '我明天把那把椅子修了。搬走以前，总该让它能坐人。', '明日、あの椅子を直す。運び出す前に、一度くらい座れるようにしたい。')
line('original-4', '陈屿', '我能来帮忙吗？十点。我会提前出门。', '手伝いに来てもいい？十時。今度は早く出る。')
line('original-5', '陆遥', '九点半。修理铺十点就要来搬了。', '九時半。十時には、修理屋さんが引き取りに来るから。')
note('ending-original', '她把真正的时间告诉了我。\n录音放到那七秒时，我没有去碰推子。程夏往旁边挪了半个座位，陆遥坐了过去。\n我留在机器旁，听完了那一面。\n\n——原声放映 · 完——', '本当の時間を教えてくれた。\nあの七秒が来ても、フェーダーには触らなかった。彼女が少し詰め、隣に映写室の主が座る。\n僕は機械のそばで、テープの片面を最後まで聞いた。\n\n——そのままの声・了——')

previous = undefined; scene = 5
line('live-1', '陈屿', '原带还给你。今晚的片尾，你们愿意重新录吗？', 'テープは返すよ。今夜の最後に、二人の声を新しく録ってもいい？', { audio: music('live') })
edges.push({ id: 'choose-live', source: choice, target: 'live-1', sourceHandle: 'choice-1', label: '今晚的片尾', animated: true })
show('live-chengxia', '程夏', 'smile', 'right')
line('live-2', '程夏', '不唱歌。嗓子冷了。你上次欠我的那碗面，先记着。', '歌はなし。喉が冷えちゃった。借りたままの麺一杯、忘れないでね。')
line('live-3', '陆遥', '那录什么？停业通知我已经读腻了。', '何を録る？閉館のお知らせなら、もう読み飽きた。')
line('live-4', '程夏', '录你明天的安排。别老说这儿关门以后，你就没事做了。', '明日の予定。ここが閉まったら何もない、なんて言わないで。')
note('live-note', '陆遥把贴在放映机上的交接单揭下来，背面列着七家电影院的地址。\n最上面那家在程夏住的街区。原来有人早已经买好车票，只是一直没有开口。', '映写機の引き継ぎ票を剥がすと、裏に七つの映画館の住所があった。\n一番上は、歌い手の住む街だった。もう切符を買っていた人が、ここにもいた。')
show('live-luyao', '陆遥', 'smile', 'left')
line('live-5', '陆遥', '明天下午的车。到站以后，能去你那里坐一会儿吗？', '明日の午後の列車。着いたら、そっちに寄ってもいい？')
line('live-6', '程夏', '来吧。椅子只有两把，你帮我带一把。', 'おいで。椅子、二つしかないから、一つ持ってきて。')
note('ending-live', '我按下录音。两个人为带哪把椅子商量了好久，直到外面的观众催开场。\n这段片尾没有音乐，听得见雨，也听得见她们拉开门的声音。\n光标经过第七秒。我看着它，走到了第八秒。\n\n——今晚的片尾 · 完——', '録音を始めた。どの椅子を持っていくか、二人は客に開映を催促されるまで相談していた。\nこのエンドロールには音楽がない。雨と、扉を開ける二人の音がある。\nカーソルが七秒を過ぎる。そのまま、八秒へ進んだ。\n\n——今夜のエンドロール・了——', { audio: { bgm: { action: 'stop', fadeOutMs: 2000 } } })

export const SEVENTH_ROW_DEMO = {
  id: 'dreamchord-seventh-row', title: '第七排，空座',
  description: '旧影院停业前夜，一段被换成七秒空白的演出录音，把三位旧友带回那张无人坐下的椅子。约 6–8 分钟 · 两个结局 · 完整中日配音。',
  cover: `${root}/cinema-rain.webp`, chapterTitle: '最后一场', graph: { nodes, edges } as StoryGraph,
  characters: [
    { slug: 'luyao', name: '陆遥', description: '24 岁，白帆影院放映员。习惯替别人留一盏灯，也已经买好了离开的车票。', color: '#55766e', defaultSprite: `${root}/luyao-normal.png` },
    { slug: 'chengxia', name: '程夏', description: '24 岁，独立歌手。八年前在这里唱过一首没练熟的歌，今晚回来拿走属于自己的原带。', color: '#9c5962', defaultSprite: `${root}/chengxia-normal.png` },
    { slug: 'chenyu', name: '陈屿', description: '26 岁，声音修复师。能去掉磁带上的杂音，还在学习听完别人的话。', color: '#7c6c55', defaultSprite: `${root}/chenyu-normal.png` },
  ],
} as const

export const FEATURED_DEMO_ID = SEVENTH_ROW_DEMO.id
