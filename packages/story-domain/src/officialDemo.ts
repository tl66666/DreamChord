import type { StoryEdge, StoryGraph, StoryNode, StoryNodeType, VoiceDirection } from './types.js'
import { directVoiceLine } from './voiceDirection.js'

const nodes: StoryNode[] = []
const edges: StoryEdge[] = []
let x = 80

type Role = 'yuki' | 'ren' | 'miya' | 'sora' | 'ghost'
type Scene = { id: string; title: string }
type AudioDirection = {
  bgm?: { action: 'keep' | 'play' | 'stop'; url?: string; volume?: number; fadeInMs?: number; fadeOutMs?: number }
  sfx?: Array<{ url: string; volume?: number }>
}

const MUSIC = {
  twilight: '/assets/audio/demo/twilight.ogg',
  erasure: '/assets/audio/demo/erasure.ogg',
  ren: '/assets/audio/demo/ren.ogg',
  miya: '/assets/audio/demo/miya.ogg',
  sora: '/assets/audio/demo/sora.ogg',
  finale: '/assets/audio/demo/finale.ogg',
  failure: '/assets/audio/demo/ending-failure.ogg',
  coauthor: '/assets/audio/demo/ending-coauthor.ogg',
  agency: '/assets/audio/demo/ending-agency.ogg',
} as const

const SFX = {
  erase: '/assets/audio/demo/sfx-erase.ogg',
  paper: '/assets/audio/demo/sfx-paper.ogg',
  node: '/assets/audio/demo/sfx-node.ogg',
  clock: '/assets/audio/demo/sfx-clock.ogg',
  save: '/assets/audio/demo/sfx-save.ogg',
} as const

function add(id: string, type: StoryNodeType, scene: Scene, data: Record<string, unknown>) {
  const sceneNumber = Number(scene.id.match(/^scene-(\d+)/)?.[1] ?? 1)
  nodes.push({
    id,
    type,
    position: { x, y: 100 + (nodes.length % 6) * 145 },
    data: { ...data, sceneGroupId: scene.id, sceneTitle: scene.title, sceneCode: `1-${sceneNumber}` },
  })
  x += 150
  return id
}

function link(source: string, target: string, sourceHandle?: string, label?: string) {
  edges.push({ id: `edge-${source}-${target}-${sourceHandle || 'next'}`, source, target, sourceHandle, label, animated: true })
}

function chain(...ids: string[]) {
  for (let index = 0; index < ids.length - 1; index += 1) link(ids[index]!, ids[index + 1]!)
}

function bg(id: string, scene: Scene, backgroundId: string) {
  return add(id, 'background', scene, { backgroundId })
}

function character(id: string, scene: Scene, characterId: Role, action: 'show' | 'hide' | 'move', expression: string, position: 'left' | 'center' | 'right') {
  return add(id, 'character', scene, { characterId, action, expression, position })
}

function transition(id: string, scene: Scene, effect: string, duration: number) {
  return add(id, 'transition', scene, { effect, duration })
}

function subtitle(id: string, scene: Scene, text: string, duration = 1.4) {
  return add(id, 'subtitle', scene, { role: 'ghost', text, position: 'center', duration })
}

function line(
  id: string,
  scene: Scene,
  role: Role,
  text: string,
  options: { voice?: Partial<Pick<VoiceDirection, 'emotion' | 'intensity' | 'pace' | 'pauseProfile' | 'delivery'>>; audio?: AudioDirection } = {},
) {
  return add(id, 'dialogue', scene, {
    role,
    text,
    voiceDirection: directVoiceLine({ role, text, overrides: options.voice }),
    audio: options.audio || { bgm: { action: 'keep' } },
  })
}

const s1: Scene = { id: 'scene-01-erased-page', title: '稿纸归零' }
chain(
  bg('s1-bg', s1, 'bg-classroom'),
  transition('s1-fade', s1, 'fade-from-black', 1.2),
  subtitle('s1-time', s1, '16:47 · 距离社团审查还有十三分钟', 1.8),
  character('s1-yuki', s1, 'yuki', 'show', 'normal', 'center'),
  line('s1-d1', s1, 'yuki', '最后一页……只差最后一句。', {
    audio: { bgm: { action: 'play', url: MUSIC.twilight, volume: 0.42, fadeInMs: 1200 }, sfx: [{ url: SFX.paper, volume: 0.45 }] },
  }),
  line('s1-d2', s1, 'yuki', '等等，刚才写下的字呢？', {
    audio: { bgm: { action: 'stop', fadeOutMs: 450 }, sfx: [{ url: SFX.erase, volume: 0.72 }] },
  }),
  character('s1-yuki-startled', s1, 'yuki', 'show', 'surprised', 'center'),
  line('s1-d3', s1, 'yuki', '剪贴板是空的，云端备份也在一行行变白。'),
  character('s1-ghost', s1, 'ghost', 'show', 'normal', 'right'),
  line('s1-d4', s1, 'ghost', '同步删除已扩散至打印稿。剩余时间：十二分四十六秒。', {
    audio: { bgm: { action: 'play', url: MUSIC.erasure, volume: 0.28, fadeInMs: 700 }, sfx: [{ url: SFX.clock, volume: 0.38 }] },
  }),
  line('s1-d5', s1, 'yuki', '你是谁？为什么知道我的稿件？'),
  line('s1-d6', s1, 'ghost', '我是被删改记录暂时拼出的界面。先别相信我。'),
  line('s1-d7', s1, 'yuki', '那就告诉我，哪一条记录还没有消失。', { voice: { emotion: 'resolve', intensity: 0.58 } }),
)

const s2: Scene = { id: 'scene-02-classroom-echo', title: '教室残响' }
const s2Start = bg('s2-bg', s2, 'bg-classroom')
link('s1-d7', s2Start)
chain(
  s2Start,
  subtitle('s2-node-caption', s2, '雪触碰了教室中央唯一没有熄灭的节点。'),
  line('s2-d1', s2, 'ghost', '警告：强制恢复会占用现实锚点。'),
  line('s2-d2', s2, 'yuki', '我只恢复一句，不会伤到任何人。', { voice: { emotion: 'tense', intensity: 0.46 } }),
  line('s2-d3', s2, 'ghost', '恢复开始。'),
  character('s2-miya', s2, 'miya', 'show', 'warm', 'left'),
  line('s2-d4', s2, 'miya', '雪，你为什么一个人在我们的教室？'),
  line('s2-d5', s2, 'yuki', '“我们的”？这里是轻小说部活动室。你写过开场。'),
  line('s2-d6', s2, 'miya', '我不写小说。可这张便签……确实是我的字。', { audio: { bgm: { action: 'keep' }, sfx: [{ url: SFX.paper, volume: 0.58 }] } }),
  subtitle('s2-note', s2, '便签上只剩半句：如果结局必须有人消失——'),
  line('s2-d7', s2, 'yuki', '恢复的不是稿子，是从宫那里拿走了一段记忆。', { voice: { emotion: 'afraid', intensity: 0.52 } }),
  line('s2-d8', s2, 'ghost', '第一处断线位于旧校舍后的樱花路。'),
)

const s3: Scene = { id: 'scene-03-shadow-road', title: '樱花路上的影子' }
const s3Start = bg('s3-bg', s3, 'bg-sakura')
link('s2-d8', s3Start)
chain(
  s3Start,
  transition('s3-wipe', s3, 'petal-wipe', 0.9),
  character('s3-hide-miya', s3, 'miya', 'hide', 'normal', 'left'),
  character('s3-hide-ghost', s3, 'ghost', 'hide', 'normal', 'right'),
  character('s3-yuki', s3, 'yuki', 'show', 'surprised', 'left'),
  character('s3-ren', s3, 'ren', 'show', 'serious', 'right'),
  line('s3-d1', s3, 'ren', '“于是他在无人抵达的站台，替所有人等到天亮。”', { audio: { bgm: { action: 'play', url: MUSIC.ren, volume: 0.36, fadeInMs: 900 } } }),
  line('s3-d2', s3, 'yuki', '那是第一版的下一句。我从没给任何人看过。'),
  line('s3-d3', s3, 'ren', '你也没给我看完。删稿以后，我在那座站台等了两年。'),
  line('s3-d4', s3, 'yuki', '影……原来你不是我记错的名字。'),
  line('s3-d5', s3, 'ren', '别急着道歉。先说清楚，你为什么又想把我们写回来。'),
)
const choice1 = add('s3-choice', 'choice', s3, {
  choices: ['承认：我害怕证明自己没有才能', '请求：让我带着旧稿重新写一次', '交还：这次由你们决定故事方向'],
  effects: [
    [{ kind: 'setVariable', variable: 'authorStance', value: 'fear' }],
    [{ kind: 'setVariable', variable: 'authorStance', value: 'rewrite' }],
    [{ kind: 'setVariable', variable: 'authorStance', value: 'agency' }],
  ],
})
link('s3-d5', choice1)

const s3Fear1 = line('s3-fear-1', s3, 'yuki', '我怕退稿不是偶然，怕写到最后只证明我没有才能。', { voice: { emotion: 'afraid', intensity: 0.58 } })
const s3Fear2 = line('s3-fear-2', s3, 'ren', '至少这一次，你没有先删掉自己的回答。', { audio: { bgm: { action: 'keep' }, sfx: [{ url: SFX.node, volume: 0.34 }] } })
link(choice1, s3Fear1, 'choice-0', '承认恐惧'); link(s3Fear1, s3Fear2)
const s3Rewrite1 = line('s3-rewrite-1', s3, 'yuki', '我不会假装旧稿没存在。让我带着所有修改痕迹重写。')
const s3Rewrite2 = line('s3-rewrite-2', s3, 'ren', '重写不是赦免。先把每一次删除都留下。', { audio: { bgm: { action: 'keep' }, sfx: [{ url: SFX.node, volume: 0.34 }] } })
link(choice1, s3Rewrite1, 'choice-1', '选择重写'); link(s3Rewrite1, s3Rewrite2)
const s3Agency1 = line('s3-agency-1', s3, 'yuki', '我不该替你们决定沉默。影，你希望故事先去哪里？')
const s3Agency2 = line('s3-agency-2', s3, 'ren', '先去找宫。不是因为剧情需要，是因为她也被你删过。', { audio: { bgm: { action: 'keep' }, sfx: [{ url: SFX.node, volume: 0.34 }] } })
link(choice1, s3Agency1, 'choice-2', '交还选择'); link(s3Agency1, s3Agency2)
const s3Merge = line('s3-merge-1', s3, 'yuki', '宫手里的便签，或许不是提醒，而是剩下的半份终页。')
const s3Exit = line('s3-merge-2', s3, 'ren', '咖啡馆后排。你删稿那晚，她在那里打印了最后一份。')
link(s3Fear2, s3Merge); link(s3Rewrite2, s3Merge); link(s3Agency2, s3Merge); link(s3Merge, s3Exit)

const s4: Scene = { id: 'scene-04-cafe-truth', title: '咖啡馆的两种笔迹' }
const s4Start = bg('s4-bg', s4, 'bg-cafe')
link(s3Exit, s4Start)
chain(
  s4Start,
  character('s4-hide-ren', s4, 'ren', 'hide', 'normal', 'right'),
  character('s4-miya', s4, 'miya', 'show', 'warm', 'right'),
  line('s4-d1', s4, 'miya', '店员从旧文件夹里找到了这张打印稿。', { audio: { bgm: { action: 'play', url: MUSIC.miya, volume: 0.38, fadeInMs: 1100 }, sfx: [{ url: SFX.paper, volume: 0.45 }] } }),
  line('s4-d2', s4, 'yuki', '上半页是我的字，下半页……是你的。'),
  line('s4-d3', s4, 'miya', '我不记得写过，但每一处修改都知道我会怎么改。'),
  line('s4-d4', s4, 'yuki', '署名栏为什么只有我？'),
  line('s4-d5', s4, 'miya', '退稿那晚，你说没有结局就不算失败，然后删掉了全部备份。'),
  line('s4-d6', s4, 'yuki', '我删掉的不只是失败，还把你的那一半也据为己有。', { voice: { emotion: 'sad', intensity: 0.62 } }),
  line('s4-d7', s4, 'miya', '先别替失去记忆的我原谅你。把终页找回来，让我自己判断。', { voice: { emotion: 'resolve', intensity: 0.56 } }),
  line('s4-d8', s4, 'ghost', '检测到第二种笔迹。星形节点正在请求打开。'),
)

const s5: Scene = { id: 'scene-05-star-space', title: '星弦空间' }
const s5Start = bg('s5-bg', s5, 'bg-starry')
link('s4-d8', s5Start)
chain(
  s5Start,
  transition('s5-dissolve', s5, 'node-dissolve', 1.1),
  character('s5-hide-miya', s5, 'miya', 'hide', 'normal', 'right'),
  character('s5-ghost', s5, 'ghost', 'show', 'normal', 'right'),
  character('s5-sora', s5, 'sora', 'show', 'curious', 'center'),
  line('s5-d1', s5, 'sora', '我……是……终页。还是，终页里的空位？', { voice: { emotion: 'afraid', intensity: 0.38, pace: 0.82, delivery: '轻而断续，像第一次组织语言，但每个字都要清楚' }, audio: { bgm: { action: 'play', url: MUSIC.sora, volume: 0.32, fadeInMs: 1400 } } }),
  line('s5-d2', s5, 'yuki', '你一直在这里，却连名字都没有。'),
  line('s5-d3', s5, 'ghost', '旧终页定义：无名角色完成牺牲，主角获得完整结局。'),
  line('s5-d4', s5, 'sora', '恢复以后，我会消失吗？'),
  line('s5-d5', s5, 'ghost', '不是消失。是被固定成只发生一次的功能。'),
  line('s5-d6', s5, 'yuki', '把角色写成工具，再说那是完整——这不是我要找的终页。'),
  line('s5-d7', s5, 'sora', '可如果不恢复，影和宫失去的东西怎么办？'),
  line('s5-d8', s5, 'yuki', '我还不知道。但答案不能再从你的沉默里拿。'),
)

const s6: Scene = { id: 'scene-06-naming', title: '命名' }
chain(
  subtitle('s6-name-caption', s6, '星形节点等待输入。'),
  line('s6-d1', s6, 'yuki', '如果可以自己选，你想保留哪个字？'),
  line('s6-d2', s6, 'sora', '空。不是空白，是还可以装下别的答案。', { voice: { emotion: 'warm', intensity: 0.4 } }),
  line('s6-d3', s6, 'yuki', '好。你叫空。不是我的命名，是你的选择。', { audio: { bgm: { action: 'keep' }, sfx: [{ url: SFX.node, volume: 0.62 }] } }),
  character('s6-sora-happy', s6, 'sora', 'show', 'happy', 'center'),
  line('s6-d4', s6, 'sora', '我听见自己的名字了。雪，你的声音怎么变远了？'),
  character('s6-yuki-flicker', s6, 'yuki', 'show', 'surprised', 'left'),
  line('s6-d5', s6, 'ghost', '现实锚点重新分配。雪的姓名字段正在闪烁。', { audio: { bgm: { action: 'stop', fadeOutMs: 380 }, sfx: [{ url: SFX.erase, volume: 0.5 }] } }),
  line('s6-d6', s6, 'ghost', '……请停止恢复。下一次交换，可能无法撤回。', { voice: { emotion: 'afraid', intensity: 0.36, delivery: '第一次带出迟疑，仍尽量维持系统播报' } }),
  line('s6-d7', s6, 'yuki', '你刚才说了“请”。系统不会请求作者。'),
)
link('s5-d8', 's6-name-caption')

const s7: Scene = { id: 'scene-07-consequence', title: '分支回响' }
const s7Start = line('s7-start', s7, 'ghost', '正在读取樱花路选择。不同立场将产生不同回响。', { audio: { bgm: { action: 'play', url: MUSIC.finale, volume: 0.28, fadeInMs: 900 } } })
link('s6-d7', s7Start)
const s7Gate = line('s7-gate', s7, 'yuki', '让我看看，当时那句话真正改变了什么。')
link(s7Start, s7Gate)
const s7FearCondition = add('s7-condition-fear', 'condition', s7, { variable: 'authorStance', operator: '==', value: 'fear' })
const s7RewriteCondition = add('s7-condition-rewrite', 'condition', s7, { variable: 'authorStance', operator: '==', value: 'rewrite' })
link(s7Gate, s7FearCondition)
const s7Fear = line('s7-fear-echo', s7, 'yuki', '我还是想逃。承认以后，害怕并没有马上消失。', { voice: { emotion: 'afraid', intensity: 0.48 }, audio: { bgm: { action: 'play', url: MUSIC.ren, volume: 0.3, fadeInMs: 500 } } })
const s7FearReply = line('s7-fear-reply', s7, 'ren', '没消失也可以往前。至少这次，我知道你为什么松手。', { voice: { emotion: 'warm', intensity: 0.34 } })
link(s7FearCondition, s7Fear, 'true', '承认恐惧'); link(s7Fear, s7FearReply)
const s7Rewrite = line('s7-rewrite-echo', s7, 'yuki', '我要重写，但所有旧版本都留下，谁也不能替谁擦除。', { audio: { bgm: { action: 'play', url: MUSIC.miya, volume: 0.32, fadeInMs: 500 } } })
const s7RewriteReply = line('s7-rewrite-reply', s7, 'miya', '那就把修改记录放进正文。共同创作不是藏在致谢里。', { voice: { emotion: 'resolve', intensity: 0.52 } })
link(s7FearCondition, s7RewriteCondition, 'false', '继续判断'); link(s7RewriteCondition, s7Rewrite, 'true', '选择重写'); link(s7Rewrite, s7RewriteReply)
const s7Agency = line('s7-agency-echo', s7, 'sora', '我的条件是：终页可以结束这一章，但不能替我结束未来。', { voice: { emotion: 'resolve', intensity: 0.55 }, audio: { bgm: { action: 'play', url: MUSIC.sora, volume: 0.33, fadeInMs: 500 } } })
const s7AgencyReply = line('s7-agency-reply', s7, 'yuki', '收到。我只记录，不替你回答。')
link(s7RewriteCondition, s7Agency, 'false', '交还选择'); link(s7Agency, s7AgencyReply)
const s7Merge = line('s7-merge', s7, 'ghost', '回响已固定。终页不再只有一种正确答案。', { audio: { bgm: { action: 'keep' }, sfx: [{ url: SFX.node, volume: 0.5 }] } })
link(s7FearReply, s7Merge); link(s7RewriteReply, s7Merge); link(s7AgencyReply, s7Merge)

const s8: Scene = { id: 'scene-08-final-page', title: '写下终页' }
chain(
  subtitle('s8-time', s8, '16:58 · 距离审查还有两分钟', 1.5),
  line('s8-d1', s8, 'yuki', '你不是系统。你到底是谁？'),
  line('s8-d2', s8, 'ghost', '我是四百一十七次自动保存、批注和删除记录的残留。'),
  line('s8-d3', s8, 'ghost', '我记得每个被删掉的人，所以不愿再执行那张旧终页。', { voice: { emotion: 'sad', intensity: 0.42, delivery: '仍像系统播报，但第一次允许一句话带出难过' } }),
  line('s8-d4', s8, 'yuki', '你不是故障。你是这部作品最早留下来的读者。', { voice: { emotion: 'warm', intensity: 0.46 } }),
  line('s8-d5', s8, 'ghost', '请写下新的终页。代价必须保留，未来不必锁定。'),
)
link(s7Merge, 's8-time')
const choice2 = add('s8-choice', 'choice', s8, {
  choices: ['保留退稿与失败：接受审查不通过，换取真实的下一章', '共同署名并公开修改记录：所有人共享作品，也共享责任', '只写问题，不替角色回答：让结局完整，但未来保持开放'],
})
link('s8-d5', choice2)

const s9: Scene = { id: 'scene-09-after-sunset', title: '日落之后' }
function ending(config: { prefix: 'ending-failure' | 'ending-coauthor' | 'ending-agency'; handle: 'choice-0' | 'choice-1' | 'choice-2'; label: string; music: string; write: string; saved: string; miya: string; sora: string; ren: string; closing: string }) {
  const write = line(`${config.prefix}-write`, s8, 'yuki', config.write, { audio: { bgm: { action: 'play', url: config.music, volume: 0.38, fadeInMs: 1000 } } })
  const saved = line(`${config.prefix}-save`, s8, 'ghost', config.saved, { audio: { bgm: { action: 'keep' }, sfx: [{ url: SFX.save, volume: 0.64 }] } })
  const classroom = bg(`${config.prefix}-bg`, s9, 'bg-classroom')
  const fade = transition(`${config.prefix}-fade`, s9, 'white-fade', 1.2)
  const hideGhost = character(`${config.prefix}-hide-ghost`, s9, 'ghost', 'hide', 'normal', 'right')
  const showMiya = character(`${config.prefix}-miya`, s9, 'miya', 'show', 'smile', 'right')
  const showSora = character(`${config.prefix}-sora`, s9, 'sora', 'show', 'happy', 'left')
  const showYuki = character(`${config.prefix}-yuki`, s9, 'yuki', 'show', 'smile', 'center')
  const reality = line(`${config.prefix}-reality`, s9, 'miya', config.miya)
  const response = line(`${config.prefix}-response`, s9, 'sora', config.sora)
  const witness = line(`${config.prefix}-witness`, s9, 'ren', config.ren)
  const closing = line(`${config.prefix}-closing`, s9, 'yuki', config.closing, { voice: { emotion: 'warm', intensity: 0.5 } })
  link(choice2, write, config.handle, config.label)
  chain(write, saved, classroom, fade, hideGhost, showMiya, showSora, showYuki, reality, response, witness, closing)
}

ending({ prefix: 'ending-failure', handle: 'choice-0', label: '保留失败', music: MUSIC.failure, write: '我写下退稿、逃避和删除。失败不被修正，只成为下一章的开头。', saved: '终页已恢复。版本标记：失败记录永久保留。', miya: '16:59。旧稿没有通过，但老师给了我们一周提交重写版。', sora: '原来没有赢，也可以继续。那下一页从不完美的地方开始。', ren: '这一次，废稿没有被藏起来。我愿意再等七天。', closing: '今天不庆祝奇迹。只庆祝我们没有再次删除失败。' })
ending({ prefix: 'ending-coauthor', handle: 'choice-1', label: '共同署名', music: MUSIC.coauthor, write: '我写下所有人的名字，也附上每一次修改和反对意见。', saved: '终页已恢复。署名节点：四。修改历史：公开。', miya: '16:59。老师收下完整稿，下周要检查所有成员的修改记录。', sora: '共同署名不是把责任分小，是让每个人都能说哪里不诚实。', ren: '包括我反对重写的部分，也要留在记录里。', closing: '好。下一次保存之前，我们先问完每一个人的意见。' })
ending({ prefix: 'ending-agency', handle: 'choice-2', label: '交还选择', music: MUSIC.agency, write: '我只写下一个问题，不替空回答。真正的结局从选择开始。', saved: '终页已恢复。开放节点存在；未来保持未锁定。', miya: '16:59。老师说这不像结局，更像邀请。她愿意等读者的回答。', sora: '我的第一项选择是留下。不是因为剧情需要，是因为我想继续。', ren: '那我选择把旧站台保留，但不再要求所有人回到那里。', closing: '收到。作者不替你们落笔——下一条线，等你们亲自回答。' })

export const OFFICIAL_DEMO: { id: string; title: string; description: string; cover: string; chapterTitle: string; graph: StoryGraph; characters: Array<{ name: string; description: string; color: string; defaultSprite: string }> } = {
  id: 'dreamchord-first-thread',
  title: '第一根弦：消失的终页',
  description: '日落之前，雪必须找回被自己删除的终页，并决定作者是否有权替角色和共同创作者选择遗忘。',
  cover: '/assets/hero.png',
  chapterTitle: '第一章：消失的终页',
  graph: { nodes, edges },
  characters: [
    { name: '雪', description: '轻小说部主笔，能够看见故事节点，也必须学习为每次删改负责。', color: '#7c3aed', defaultSprite: '/assets/characters/yuki_normal.png' },
    { name: '影', description: '被废弃旧稿中幸存的主角，锋利的质问下藏着不愿再被遗忘的恐惧。', color: '#475569', defaultSprite: '/assets/characters/ren_normal.png' },
    { name: '宫', description: '雪的学姐与未被署名的共同创作者，是现实时间线留下的锚点。', color: '#b45309', defaultSprite: '/assets/characters/miya_normal.png' },
    { name: '空', description: '从旧结局的无名牺牲位中醒来的角色，希望亲自决定自己的未来。', color: '#0891b2', defaultSprite: '/assets/characters/sora_normal.png' },
    { name: '系统幽灵', description: '由自动保存、批注和删除记录形成的守门人，记得所有被删掉的版本。', color: '#8b5cf6', defaultSprite: '/assets/characters/system-ghost.png' },
  ],
}
