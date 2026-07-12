import type { StoryEdge, StoryGraph, StoryNode, StoryNodeType } from './types.js'

const nodes: StoryNode[] = []
const edges: StoryEdge[] = []
let x = 80

function add(id: string, type: StoryNodeType, sceneGroupId: string, sceneTitle: string, data: Record<string, unknown>) {
  const sceneNumber = Number(sceneGroupId.match(/^scene-(\d+)/)?.[1] ?? 1)
  nodes.push({ id, type, position: { x, y: 100 + (nodes.length % 5) * 150 }, data: { ...data, sceneGroupId, sceneTitle, sceneCode: `1-${sceneNumber}` } })
  x += 150
  return id
}

function link(source: string, target: string, sourceHandle?: string, label?: string) {
  edges.push({ id: `edge-${source}-${target}`, source, target, sourceHandle, label, animated: true })
}

function chain(...ids: string[]) {
  for (let index = 0; index < ids.length - 1; index += 1) link(ids[index]!, ids[index + 1]!)
}

const s1 = 'scene-01-erased-page'; const t1 = '稿纸归零'
chain(
  add('s1-bg', 'background', s1, t1, { backgroundId: 'bg-classroom' }),
  add('s1-yuki', 'character', s1, t1, { characterId: 'yuki', action: 'show', expression: 'surprised', position: 'center' }),
  add('s1-d1', 'dialogue', s1, t1, { role: 'ghost', text: '【16:47 · 距社团审查还有十三分钟】稿箱里最后一页正在逐字消失。' }),
  add('s1-d2', 'dialogue', s1, t1, { role: 'yuki', text: '不可能……我昨晚明明写完了。日落前交不出完整稿，轻小说部就会被正式撤销。' }),
  add('s1-d3', 'dialogue', s1, t1, { role: 'ghost', text: '检测到终页并非丢失，而是被作者主动删除。要恢复它，你必须回到每一次放弃选择的地方。' }),
)

const s2 = 'scene-02-classroom-echo'; const t2 = '教室残响'
const s2bg = add('s2-bg', 'background', s2, t2, { backgroundId: 'bg-classroom' })
link('s1-d3', s2bg)
chain(s2bg,
  add('s2-d1', 'dialogue', s2, t2, { role: 'yuki', text: '黑板、课桌、窗外的云，全被发光的节点和连线覆盖了。每个断口都停在一句“算了”。' }),
  add('s2-d2', 'dialogue', s2, t2, { role: 'ghost', text: '这些不是幻觉，是你没有写完的因果。第一处断线在旧校舍后的樱花路。' }),
  add('s2-d3', 'dialogue', s2, t2, { role: 'yuki', text: '如果终页真是我删掉的，我就亲手把它找回来。' }),
)

const s3 = 'scene-03-shadow-road'; const t3 = '樱花路上的影子'
const s3bg = add('s3-bg', 'background', s3, t3, { backgroundId: 'bg-sakura' })
link('s2-d3', s3bg)
chain(s3bg,
  add('s3-yuki', 'character', s3, t3, { characterId: 'yuki', action: 'show', expression: 'surprised', position: 'left' }),
  add('s3-ren', 'character', s3, t3, { characterId: 'ren', action: 'show', expression: 'serious', position: 'right' }),
  add('s3-d1', 'dialogue', s3, t3, { role: 'ren', text: '终于肯回来了吗，作者？我在你废弃的第一版里，等了整整两年。' }),
  add('s3-d2', 'dialogue', s3, t3, { role: 'yuki', text: '影……你是我删掉的主角。可你为什么还能站在这里？' }),
)
const choice1 = add('s3-choice', 'choice', s3, t3, { choices: ['承认我害怕写坏', '请求一次重写机会', '让角色也参与选择'] })
link('s3-d2', choice1)
const b1 = add('s3-fear', 'dialogue', s3, t3, { role: 'yuki', text: '我怕写坏，更怕别人看完后证明我根本没有才能，所以先把结局删了。' })
const b2 = add('s3-rewrite', 'dialogue', s3, t3, { role: 'yuki', text: '我不能假装旧稿从未存在。请给我一次重写的机会，这次我会把代价也写进去。' })
const b3 = add('s3-agency', 'dialogue', s3, t3, { role: 'yuki', text: '我不该替所有人决定沉默。影，这一次请告诉我，你想让故事去哪里。' })
link(choice1, b1, 'choice-0', '承认恐惧'); link(choice1, b2, 'choice-1', '选择重写'); link(choice1, b3, 'choice-2', '交还选择')
const merge1 = add('s3-merge', 'dialogue', s3, t3, { role: 'ren', text: '答案不完美，但它终于是真的。去找宫吧，她保管着你删稿那晚留下的现实记录。' })
link(b1, merge1); link(b2, merge1); link(b3, merge1)

const s4 = 'scene-04-cafe-truth'; const t4 = '咖啡馆的真相'
const s4bg = add('s4-bg', 'background', s4, t4, { backgroundId: 'bg-cafe' })
link(merge1, s4bg)
chain(s4bg,
  add('s4-hide-ren', 'character', s4, t4, { characterId: 'ren', action: 'hide', expression: 'normal', position: 'right' }),
  add('s4-miya', 'character', s4, t4, { characterId: 'miya', action: 'show', expression: 'warm', position: 'right' }),
  add('s4-d1', 'dialogue', s4, t4, { role: 'miya', text: '那晚你收到退稿信后，说“只要没有结局，就不算失败”。然后把唯一的备份也清空了。' }),
  add('s4-d2', 'dialogue', s4, t4, { role: 'yuki', text: '我以为删掉故事就能删掉羞耻。结果只是把所有人困在未完成里。' }),
  add('s4-d3', 'dialogue', s4, t4, { role: 'miya', text: '害怕不是罪，拿害怕替别人决定结局才是。最后一个缺口在你最早画下的星形节点。' }),
)

const s5 = 'scene-05-star-space'; const t5 = '星弦空间'
const s5bg = add('s5-bg', 'background', s5, t5, { backgroundId: 'bg-starry' })
link('s4-d3', s5bg)
chain(s5bg,
  add('s5-hide-miya', 'character', s5, t5, { characterId: 'miya', action: 'hide', expression: 'normal', position: 'right' }),
  add('s5-ghost', 'character', s5, t5, { characterId: 'ghost', action: 'show', expression: 'normal', position: 'right' }),
  add('s5-sora', 'character', s5, t5, { characterId: 'sora', action: 'show', expression: 'curious', position: 'center' }),
  add('s5-d1', 'dialogue', s5, t5, { role: 'ghost', text: '发现未命名角色。因为没有名字，她无法成为分支目标，也无法说出自己的选择。' }),
  add('s5-d2', 'dialogue', s5, t5, { role: 'yuki', text: '原来终页不是一句话，而是一个一直没有被允许开口的人。' }),
)

const s6 = 'scene-06-naming'; const t6 = '命名'
chain(
  add('s6-d1', 'dialogue', s6, t6, { role: 'yuki', text: '我把“空白”的空送给你。不是因为你什么都没有，而是因为你可以选择成为什么。你叫空。' }),
  add('s6-d2', 'dialogue', s6, t6, { role: 'sora', text: '空……我听见了。那我也可以决定，不只做你需要的结局工具吗？' }),
  add('s6-d3', 'dialogue', s6, t6, { role: 'yuki', text: '可以。从现在起，作者负责倾听，角色负责活下去。我们一起写。' }),
)
link('s5-d2', 's6-d1')

const s7 = 'scene-07-consequence'; const t7 = '分支回响'
chain(
  add('s7-d1', 'dialogue', s7, t7, { role: 'ren', text: '你刚才在樱花路上的回答已经改变了这里。断线重新连接，但没有抹掉旧伤。' }),
  add('s7-d2', 'dialogue', s7, t7, { role: 'miya', text: '现实中的审查表还在倒计时。你们只有三分钟，不过这一次你不是一个人。' }),
  add('s7-d3', 'dialogue', s7, t7, { role: 'sora', text: '终页已经出现了三种可能。雪，请不要选“最正确”的，选你愿意承担的。' }),
)
link('s6-d3', 's7-d1')

const s8 = 'scene-08-final-page'; const t8 = '写下终页'
const choice2 = add('s8-choice', 'choice', s8, t8, { choices: ['让失败成为下一章的开头', '让伙伴共同署名', '把选择留给故事中的人'] })
link('s7-d3', choice2)
const e1 = add('s8-e1', 'dialogue', s8, t8, { role: 'yuki', text: '我写下：失败没有关闭故事，它只是逼我们换一种方式继续。' })
const e2 = add('s8-e2', 'dialogue', s8, t8, { role: 'yuki', text: '我写下所有人的名字。作品不是我的避难所，而是我们共同留下的证词。' })
const e3 = add('s8-e3', 'dialogue', s8, t8, { role: 'yuki', text: '我写下一个问题，不替空回答。真正的结局从角色拥有选择开始。' })
link(choice2, e1, 'choice-0', '接纳失败'); link(choice2, e2, 'choice-1', '共同创作'); link(choice2, e3, 'choice-2', '交还选择')
const save = add('s8-save', 'dialogue', s8, t8, { role: 'ghost', text: '终页已恢复。故事完整度 100%。正在把新版本写回现实。' })
link(e1, save); link(e2, save); link(e3, save)

const s9 = 'scene-09-after-sunset'; const t9 = '日落之后'
const s9bg = add('s9-bg', 'background', s9, t9, { backgroundId: 'bg-classroom' })
link(save, s9bg)
chain(s9bg,
  add('s9-d1', 'dialogue', s9, t9, { role: 'miya', text: '16:59。审查老师收下了完整稿，也同意让轻小说部以新作品继续活动。' }),
  add('s9-d2', 'dialogue', s9, t9, { role: 'sora', text: '这一章结束了，但我的下一句还没有写。雪，我们去工作台看看新的故事线吧。' }),
  add('s9-d3', 'dialogue', s9, t9, { role: 'yuki', text: '好。这一次，不从“我不能”开始。从“我们接下来写什么”开始。' }),
)

export const OFFICIAL_DEMO: {
  id: string
  title: string
  description: string
  cover: string
  chapterTitle: string
  graph: StoryGraph
  characters: Array<{ name: string; description: string; color: string; defaultSprite: string }>
} = {
  id: 'dreamchord-first-thread',
  title: '第一根弦：消失的终页',
  description: '日落之前，雪必须找回被自己删除的终页，也重新学会让角色拥有选择。',
  cover: '/assets/hero.png',
  chapterTitle: '第一章：消失的终页',
  graph: { nodes, edges },
  characters: [
    { name: '雪', description: '轻小说部创作者，能够看见故事节点。', color: '#7c3aed', defaultSprite: '/assets/characters/yuki_normal.png' },
    { name: '影', description: '被废弃旧稿中幸存的主角。', color: '#475569', defaultSprite: '/assets/characters/ren_normal.png' },
    { name: '宫', description: '守住现实时间线的学姐。', color: '#b45309', defaultSprite: '/assets/characters/miya_normal.png' },
    { name: '空', description: '从无名节点中获得选择权的角色。', color: '#0891b2', defaultSprite: '/assets/characters/sora_normal.png' },
    { name: '系统幽灵', description: '故事图健康与版本变化的具象化引导者。', color: '#8b5cf6', defaultSprite: '/assets/characters/system-ghost.png' },
  ],
}
