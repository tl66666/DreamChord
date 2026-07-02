import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashed = await bcrypt.hash('demo123', 10)

  const user = await prisma.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      email: 'demo@dreamchord.dev',
      username: 'demo',
      password: hashed,
      nickname: '梦弦官方',
    },
  })

  // 旧的示例项目保留，作为简单演示
  await prisma.project.upsert({
    where: { id: 'demo-project-001' },
    update: {},
    create: {
      id: 'demo-project-001',
      title: '樱花下的初见',
      description: '一个关于青春与重逢的短篇视觉小说',
      cover: '/assets/covers/default-cover.png',
      isPublic: true,
      isPublished: true,
      authorId: user.id,
      chapters: {
        create: [
          {
            title: '序章',
            order: 0,
            nodes: {
              create: [
                {
                  nodeId: 'node-1',
                  type: 'dialogue',
                  positionX: 250,
                  positionY: 100,
                  data: JSON.stringify({ role: '旁白', text: '四月的樱花纷纷扬扬，像是在下一场粉色的雪。' }),
                },
                {
                  nodeId: 'node-2',
                  type: 'dialogue',
                  positionX: 250,
                  positionY: 260,
                  data: JSON.stringify({ role: '林晓', text: '那个人……好像在哪里见过？' }),
                },
                {
                  nodeId: 'node-3',
                  type: 'choice',
                  positionX: 250,
                  positionY: 420,
                  data: JSON.stringify({ choices: ['主动搭话', '假装没看见', '悄悄跟上去'] }),
                },
                {
                  nodeId: 'node-4',
                  type: 'dialogue',
                  positionX: 500,
                  positionY: 420,
                  data: JSON.stringify({ role: '林晓', text: '心跳得好快……但只要迈出这一步，故事就会开始。' }),
                },
                {
                  nodeId: 'node-5',
                  type: 'dialogue',
                  positionX: 500,
                  positionY: 580,
                  data: JSON.stringify({ role: '旁白', text: '你选择了沉默。樱花继续飘落，而那个身影消失在人群里。' }),
                },
                {
                  nodeId: 'node-6',
                  type: 'dialogue',
                  positionX: 500,
                  positionY: 740,
                  data: JSON.stringify({ role: '旁白', text: '你跟了上去。街道尽头，是一家从没注意过的旧书店。' }),
                },
              ],
            },
            edges: {
              create: [
                { edgeId: 'edge-1', source: 'node-1', target: 'node-2' },
                { edgeId: 'edge-2', source: 'node-2', target: 'node-3' },
                { edgeId: 'edge-3', source: 'node-3', target: 'node-4', label: '主动搭话' },
                { edgeId: 'edge-4', source: 'node-3', target: 'node-5', label: '假装没看见' },
                { edgeId: 'edge-5', source: 'node-3', target: 'node-6', label: '悄悄跟上去' },
              ],
            },
          },
        ],
      },
    },
  })

  // 官方 Demo 剧情：《第一条故事线》
  const demoProject = await prisma.project.upsert({
    where: { id: 'dreamchord-first-thread' },
    update: {},
    create: {
      id: 'dreamchord-first-thread',
      title: '第一条故事线',
      description: '梦弦 DreamChord 官方演示剧情。关于雪、影、宫、空，以及创作如何开始的故事。',
      cover: '/assets/hero.png',
      isPublic: true,
      isPublished: true,
      authorId: user.id,
      characters: {
        create: [
          {
            name: '雪',
            description: '17 岁高中生，轻小说部唯一成员，第一个看见故事线的人',
            color: '#a78bfa',
            defaultSprite: '/assets/characters/yuki_normal.png',
          },
          {
            name: '影',
            description: '神秘转学生，半系统存在，知道节点编辑器的本质',
            color: '#475569',
            defaultSprite: '/assets/characters/ren_normal.png',
          },
          {
            name: '宫',
            description: '咖啡店打工学姐，温柔的现实锚点',
            color: '#d97706',
            defaultSprite: '/assets/characters/miya_normal.png',
          },
          {
            name: '空',
            description: '用户创建的第一个空白角色，等待被填写的故事',
            color: '#fbbf24',
            defaultSprite: '/assets/characters/sora_normal.png',
          },
          {
            name: '系统幽灵',
            description: '编辑器的引导精灵，UI 具象化存在',
            color: '#c4b5fd',
            defaultSprite: '/assets/characters/system-ghost.png',
          },
        ],
      },
      chapters: {
        create: [
          {
            title: '第一章：故事开始的地方',
            order: 0,
            nodes: {
              create: [
                // Scene 01: 空白开始
                {
                  nodeId: 'bg-empty-projects',
                  type: 'background',
                  positionX: 100,
                  positionY: 80,
                  data: JSON.stringify({ backgroundId: 'illustrations/empty-projects' }),
                },
                {
                  nodeId: 'ghost-1',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 240,
                  data: JSON.stringify({ role: '系统幽灵', text: '你还没有故事。' }),
                },
                {
                  nodeId: 'ghost-2',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 400,
                  data: JSON.stringify({ role: '系统幽灵', text: '但空白不是结束。每一个故事，都是从“还没有”开始的。' }),
                },
                {
                  nodeId: 'ghost-3',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 560,
                  data: JSON.stringify({ role: '系统幽灵', text: '点击它。写下第一句话。' }),
                },
                // Scene 02: 课堂现实
                {
                  nodeId: 'bg-classroom',
                  type: 'background',
                  positionX: 400,
                  positionY: 80,
                  data: JSON.stringify({ backgroundId: 'bg-classroom' }),
                },
                {
                  nodeId: 'yuki-classroom-1',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 240,
                  data: JSON.stringify({ role: '雪', text: '……又是这样。老师在黑板上写着的公式，我一个字也听不进去。因为我又看见了。' }),
                },
                {
                  nodeId: 'yuki-classroom-2',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 400,
                  data: JSON.stringify({ role: '雪', text: '那些发光的点，还有那些连接它们的线。就飘在讲台旁边，飘在窗户透进来的阳光里。' }),
                },
                {
                  nodeId: 'yuki-classroom-3',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 560,
                  data: JSON.stringify({ role: '雪', text: '以前只是想象。现在……它们好像真的在那里。' }),
                },
                {
                  nodeId: 'ren-voice-1',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 720,
                  data: JSON.stringify({ role: '???', text: '你看得见啊。' }),
                },
                // Scene 03: 樱花街道
                {
                  nodeId: 'bg-sakura',
                  type: 'background',
                  positionX: 700,
                  positionY: 80,
                  data: JSON.stringify({ backgroundId: 'bg-sakura' }),
                },
                {
                  nodeId: 'char-yuki-sakura',
                  type: 'character',
                  positionX: 700,
                  positionY: 240,
                  data: JSON.stringify({ characterId: 'yuki', action: 'show', expression: 'surprised', position: 'left' }),
                },
                {
                  nodeId: 'char-ren-sakura',
                  type: 'character',
                  positionX: 850,
                  positionY: 240,
                  data: JSON.stringify({ characterId: 'ren', action: 'show', expression: 'normal', position: 'right' }),
                },
                {
                  nodeId: 'yuki-sakura-1',
                  type: 'dialogue',
                  positionX: 700,
                  positionY: 400,
                  data: JSON.stringify({ role: '雪', text: '你是谁？' }),
                },
                {
                  nodeId: 'ren-sakura-1',
                  type: 'dialogue',
                  positionX: 700,
                  positionY: 560,
                  data: JSON.stringify({ role: '影', text: '影。和你一样，在这个学校里。但和你不一样的是——你刚才是第一次“真的”看见它们。' }),
                },
                {
                  nodeId: 'yuki-sakura-2',
                  type: 'dialogue',
                  positionX: 700,
                  positionY: 720,
                  data: JSON.stringify({ role: '雪', text: '它们……是什么？' }),
                },
                {
                  nodeId: 'ren-sakura-2',
                  type: 'dialogue',
                  positionX: 700,
                  positionY: 880,
                  data: JSON.stringify({ role: '影', text: '故事的结构。节点，连线，分支。普通人只能经历故事，而你……能编辑它。不过现在的你，还只会看，不会写。' }),
                },
                {
                  nodeId: 'choice-a',
                  type: 'choice',
                  positionX: 700,
                  positionY: 1040,
                  data: JSON.stringify({ choices: ['我才不是不会写！', '……那你教我。', '这一定是梦。'] }),
                },
                // 分支 A
                {
                  nodeId: 'branch-a-yuki',
                  type: 'dialogue',
                  positionX: 1000,
                  positionY: 880,
                  data: JSON.stringify({ role: '雪', text: '我才不是不会写！我只是……写不完。' }),
                },
                {
                  nodeId: 'branch-a-ren',
                  type: 'dialogue',
                  positionX: 1000,
                  positionY: 1040,
                  data: JSON.stringify({ role: '影', text: '写不完，是因为你以为故事只能有一条线。但在这里，每个选择都可以延伸出一条新的线。' }),
                },
                // 分支 B
                {
                  nodeId: 'branch-b-yuki',
                  type: 'dialogue',
                  positionX: 1000,
                  positionY: 1200,
                  data: JSON.stringify({ role: '雪', text: '……那你教我。' }),
                },
                {
                  nodeId: 'branch-b-ren',
                  type: 'dialogue',
                  positionX: 1000,
                  positionY: 1360,
                  data: JSON.stringify({ role: '影', text: '我不能替你写。但我可以告诉你：节点是选择，连线是因果。你写下什么，世界就会变成什么。' }),
                },
                // 分支 C
                {
                  nodeId: 'branch-c-yuki',
                  type: 'dialogue',
                  positionX: 1000,
                  positionY: 1520,
                  data: JSON.stringify({ role: '雪', text: '这一定是梦。' }),
                },
                {
                  nodeId: 'branch-c-ren',
                  type: 'dialogue',
                  positionX: 1000,
                  positionY: 1680,
                  data: JSON.stringify({ role: '影', text: '如果是梦，你为什么还在用力记住这些对话？梦不会害怕被忘记。' }),
                },
                // 分支汇合
                {
                  nodeId: 'ren-sakura-end',
                  type: 'dialogue',
                  positionX: 700,
                  positionY: 1200,
                  data: JSON.stringify({ role: '影', text: '走吧。有人在等你“落地”。' }),
                },
                {
                  nodeId: 'hide-yuki-sakura',
                  type: 'character',
                  positionX: 700,
                  positionY: 1280,
                  data: JSON.stringify({ characterId: 'yuki', action: 'hide' }),
                },
                {
                  nodeId: 'hide-ren-sakura',
                  type: 'character',
                  positionX: 780,
                  positionY: 1280,
                  data: JSON.stringify({ characterId: 'ren', action: 'hide' }),
                },
                // Scene 04: 咖啡厅
                {
                  nodeId: 'bg-cafe',
                  type: 'background',
                  positionX: 100,
                  positionY: 1360,
                  data: JSON.stringify({ backgroundId: 'bg-cafe' }),
                },
                {
                  nodeId: 'char-miya-cafe',
                  type: 'character',
                  positionX: 100,
                  positionY: 1520,
                  data: JSON.stringify({ characterId: 'miya', action: 'show', expression: 'normal', position: 'center' }),
                },
                {
                  nodeId: 'miya-cafe-1',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 1680,
                  data: JSON.stringify({ role: '宫', text: '放学后又来这里发呆？' }),
                },
                {
                  nodeId: 'yuki-cafe-1',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 1840,
                  data: JSON.stringify({ role: '雪', text: '……宫学姐，你相信世界上有“故事的线”吗？' }),
                },
                {
                  nodeId: 'miya-cafe-2',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 2000,
                  data: JSON.stringify({ role: '宫', text: '我只相信咖啡凉了会变难喝。来，这杯给你，多加了一点糖。' }),
                },
                {
                  nodeId: 'yuki-cafe-2',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 2160,
                  data: JSON.stringify({ role: '雪', text: '可是……如果那些线是真的呢？如果我看到的世界，其实是可以被改写的呢？' }),
                },
                {
                  nodeId: 'miya-cafe-3',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 2320,
                  data: JSON.stringify({ role: '宫', text: '那你想改写什么？是把讨厌的考试改没，还是把说不出口的话改成能说出口？' }),
                },
                {
                  nodeId: 'yuki-cafe-3',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 2480,
                  data: JSON.stringify({ role: '雪', text: '我……' }),
                },
                {
                  nodeId: 'miya-cafe-4',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 2640,
                  data: JSON.stringify({ role: '宫', text: '就算世界是假的，这杯咖啡也是真的。先把这一口喝了吧。' }),
                },
                {
                  nodeId: 'yuki-cafe-4',
                  type: 'dialogue',
                  positionX: 100,
                  positionY: 2800,
                  data: JSON.stringify({ role: '雪', text: '……嗯。' }),
                },
                {
                  nodeId: 'hide-miya',
                  type: 'character',
                  positionX: 100,
                  positionY: 2880,
                  data: JSON.stringify({ characterId: 'miya', action: 'hide' }),
                },
                // Scene 05: 星空节点觉醒
                {
                  nodeId: 'bg-starry-1',
                  type: 'background',
                  positionX: 400,
                  positionY: 1360,
                  data: JSON.stringify({ backgroundId: 'bg-starry' }),
                },
                {
                  nodeId: 'ren-starry-1',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 1520,
                  data: JSON.stringify({ role: '影', text: '你感觉到了吗？' }),
                },
                {
                  nodeId: 'yuki-starry-1',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 1680,
                  data: JSON.stringify({ role: '雪', text: '什么？' }),
                },
                {
                  nodeId: 'ren-starry-2',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 1840,
                  data: JSON.stringify({ role: '影', text: '整个世界，正在变成可以编辑的样子。节点是选择，连线是因果。你之前写下的每一个字，都在悄悄改变它的形状。' }),
                },
                {
                  nodeId: 'yuki-starry-2',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 2000,
                  data: JSON.stringify({ role: '雪', text: '那我写过的那些没写完的故事呢？那些被我放弃的……它们也会在这里吗？' }),
                },
                {
                  nodeId: 'ren-starry-3',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 2160,
                  data: JSON.stringify({ role: '影', text: '会。它们会变成“空节点”。不是不存在，只是等待你回去完成。' }),
                },
                {
                  nodeId: 'yuki-starry-3',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 2320,
                  data: JSON.stringify({ role: '雪', text: '我要怎么做？' }),
                },
                {
                  nodeId: 'ren-starry-4',
                  type: 'dialogue',
                  positionX: 400,
                  positionY: 2480,
                  data: JSON.stringify({ role: '影', text: '先创造一个角色。给他一个名字。' }),
                },
                // Scene 06: 系统觉醒
                {
                  nodeId: 'bg-empty-nodes',
                  type: 'background',
                  positionX: 700,
                  positionY: 1360,
                  data: JSON.stringify({ backgroundId: 'illustrations/empty-nodes' }),
                },
                {
                  nodeId: 'ghost-editor-1',
                  type: 'dialogue',
                  positionX: 700,
                  positionY: 1520,
                  data: JSON.stringify({ role: '系统幽灵', text: '欢迎来到节点编辑器。这里是你创造世界的地方。' }),
                },
                {
                  nodeId: 'ghost-editor-2',
                  type: 'dialogue',
                  positionX: 700,
                  positionY: 1680,
                  data: JSON.stringify({ role: '系统幽灵', text: '写下第一句话。任何一句话都可以。' }),
                },
                {
                  nodeId: 'input-name',
                  type: 'dialogue',
                  positionX: 700,
                  positionY: 1840,
                  data: JSON.stringify({ role: '雪', text: '请给我一个名字。' }),
                },
                {
                  nodeId: 'ghost-editor-3',
                  type: 'dialogue',
                  positionX: 700,
                  positionY: 2000,
                  data: JSON.stringify({ role: '系统幽灵', text: '命名完成。第一个角色已创建。' }),
                },
                // Scene 07: 角色诞生
                {
                  nodeId: 'bg-starry-2',
                  type: 'background',
                  positionX: 1000,
                  positionY: 1360,
                  data: JSON.stringify({ backgroundId: 'bg-starry' }),
                },
                {
                  nodeId: 'char-sora-born',
                  type: 'character',
                  positionX: 1000,
                  positionY: 1520,
                  data: JSON.stringify({ characterId: 'sora', action: 'show', expression: 'curious', position: 'center' }),
                },
                {
                  nodeId: 'sora-1',
                  type: 'dialogue',
                  positionX: 1000,
                  positionY: 1680,
                  data: JSON.stringify({ role: '???', text: '我……我有了名字吗？' }),
                },
                {
                  nodeId: 'yuki-name-sora',
                  type: 'dialogue',
                  positionX: 1000,
                  positionY: 1840,
                  data: JSON.stringify({ role: '雪', text: '你叫空。因为我现在还不知道你要成为什么样的人。' }),
                },
                {
                  nodeId: 'sora-2',
                  type: 'dialogue',
                  positionX: 1000,
                  positionY: 2000,
                  data: JSON.stringify({ role: '空', text: '空……那我会一直是空的吗？' }),
                },
                {
                  nodeId: 'choice-b',
                  type: 'choice',
                  positionX: 1000,
                  positionY: 2160,
                  data: JSON.stringify({ choices: ['不会，我会帮你填满。', '空不是缺少，而是可能。', '你可以自己选择。'] }),
                },
                // 分支 A2
                {
                  nodeId: 'branch-a2-yuki',
                  type: 'dialogue',
                  positionX: 1300,
                  positionY: 2000,
                  data: JSON.stringify({ role: '雪', text: '不会，我会帮你填满。' }),
                },
                {
                  nodeId: 'branch-a2-sora',
                  type: 'dialogue',
                  positionX: 1300,
                  positionY: 2160,
                  data: JSON.stringify({ role: '空', text: '那你会一直写下去吗？' }),
                },
                {
                  nodeId: 'branch-a2-yuki-2',
                  type: 'dialogue',
                  positionX: 1300,
                  positionY: 2320,
                  data: JSON.stringify({ role: '雪', text: '我会的。' }),
                },
                // 分支 B2
                {
                  nodeId: 'branch-b2-yuki',
                  type: 'dialogue',
                  positionX: 1300,
                  positionY: 2480,
                  data: JSON.stringify({ role: '雪', text: '空不是缺少，而是可能。' }),
                },
                {
                  nodeId: 'branch-b2-sora',
                  type: 'dialogue',
                  positionX: 1300,
                  positionY: 2640,
                  data: JSON.stringify({ role: '空', text: '可能……我喜欢这个词。' }),
                },
                // 分支 C2
                {
                  nodeId: 'branch-c2-yuki',
                  type: 'dialogue',
                  positionX: 1300,
                  positionY: 2800,
                  data: JSON.stringify({ role: '雪', text: '你可以自己选择。' }),
                },
                {
                  nodeId: 'branch-c2-sora',
                  type: 'dialogue',
                  positionX: 1300,
                  positionY: 2960,
                  data: JSON.stringify({ role: '空', text: '真的吗？那我可以选择……成为你的朋友吗？' }),
                },
                // 汇合
                {
                  nodeId: 'sora-happy',
                  type: 'character',
                  positionX: 1000,
                  positionY: 2320,
                  data: JSON.stringify({ characterId: 'sora', action: 'show', expression: 'happy', position: 'center' }),
                },
                {
                  nodeId: 'sora-end',
                  type: 'dialogue',
                  positionX: 1000,
                  positionY: 2480,
                  data: JSON.stringify({ role: '空', text: '谢谢你，创造者。我会努力成为一个好角色的。' }),
                },
                // Scene 08: 回到起点
                {
                  nodeId: 'bg-end',
                  type: 'background',
                  positionX: 1300,
                  positionY: 1360,
                  data: JSON.stringify({ backgroundId: 'illustrations/empty-projects' }),
                },
                {
                  nodeId: 'ghost-end-1',
                  type: 'dialogue',
                  positionX: 1300,
                  positionY: 1520,
                  data: JSON.stringify({ role: '系统幽灵', text: '雪写下了第一句话。影连接了第一个节点。宫让故事有了温度。空拥有了名字。' }),
                },
                {
                  nodeId: 'ghost-end-2',
                  type: 'dialogue',
                  positionX: 1300,
                  positionY: 1680,
                  data: JSON.stringify({ role: '系统幽灵', text: '这就是 DreamChord 的第一条故事线。现在，轮到你了。' }),
                },
                {
                  nodeId: 'ghost-end-3',
                  type: 'choice',
                  positionX: 1300,
                  positionY: 1840,
                  data: JSON.stringify({ choices: ['创建我的第一个项目', '查看作品广场', '再读一遍'] }),
                },
                {
                  nodeId: 'ghost-end-final',
                  type: 'dialogue',
                  positionX: 1600,
                  positionY: 1840,
                  data: JSON.stringify({ role: '系统幽灵', text: '无论你选择哪条路，故事都会继续。下次见，创作者。' }),
                },
              ],
            },
            edges: {
              create: [
                // Scene 01
                { edgeId: 'e-ghost-1', source: 'bg-empty-projects', target: 'ghost-1' },
                { edgeId: 'e-ghost-2', source: 'ghost-1', target: 'ghost-2' },
                { edgeId: 'e-ghost-3', source: 'ghost-2', target: 'ghost-3' },
                { edgeId: 'e-to-classroom', source: 'ghost-3', target: 'bg-classroom' },
                // Scene 02
                { edgeId: 'e-classroom-1', source: 'bg-classroom', target: 'yuki-classroom-1' },
                { edgeId: 'e-classroom-2', source: 'yuki-classroom-1', target: 'yuki-classroom-2' },
                { edgeId: 'e-classroom-3', source: 'yuki-classroom-2', target: 'yuki-classroom-3' },
                { edgeId: 'e-classroom-4', source: 'yuki-classroom-3', target: 'ren-voice-1' },
                { edgeId: 'e-to-sakura', source: 'ren-voice-1', target: 'bg-sakura' },
                // Scene 03
                { edgeId: 'e-sakura-bg', source: 'bg-sakura', target: 'char-yuki-sakura' },
                { edgeId: 'e-sakura-char', source: 'char-yuki-sakura', target: 'char-ren-sakura' },
                { edgeId: 'e-sakura-1', source: 'char-ren-sakura', target: 'yuki-sakura-1' },
                { edgeId: 'e-sakura-2', source: 'yuki-sakura-1', target: 'ren-sakura-1' },
                { edgeId: 'e-sakura-3', source: 'ren-sakura-1', target: 'yuki-sakura-2' },
                { edgeId: 'e-sakura-4', source: 'yuki-sakura-2', target: 'ren-sakura-2' },
                { edgeId: 'e-to-choice-a', source: 'ren-sakura-2', target: 'choice-a' },
                // 分支 A
                { edgeId: 'e-choice-a-0', source: 'choice-a', target: 'branch-a-yuki', label: '我才不是不会写！' },
                { edgeId: 'e-branch-a', source: 'branch-a-yuki', target: 'branch-a-ren' },
                { edgeId: 'e-branch-a-end', source: 'branch-a-ren', target: 'ren-sakura-end' },
                // 分支 B
                { edgeId: 'e-choice-b-0', source: 'choice-a', target: 'branch-b-yuki', label: '……那你教我。' },
                { edgeId: 'e-branch-b', source: 'branch-b-yuki', target: 'branch-b-ren' },
                { edgeId: 'e-branch-b-end', source: 'branch-b-ren', target: 'ren-sakura-end' },
                // 分支 C
                { edgeId: 'e-choice-c-0', source: 'choice-a', target: 'branch-c-yuki', label: '这一定是梦。' },
                { edgeId: 'e-branch-c', source: 'branch-c-yuki', target: 'branch-c-ren' },
                { edgeId: 'e-branch-c-end', source: 'branch-c-ren', target: 'ren-sakura-end' },
                // To cafe
                { edgeId: 'e-to-hide-yuki', source: 'ren-sakura-end', target: 'hide-yuki-sakura' },
                { edgeId: 'e-to-hide-ren', source: 'hide-yuki-sakura', target: 'hide-ren-sakura' },
                { edgeId: 'e-to-cafe', source: 'hide-ren-sakura', target: 'bg-cafe' },
                // Scene 04
                { edgeId: 'e-cafe-bg', source: 'bg-cafe', target: 'char-miya-cafe' },
                { edgeId: 'e-cafe-char', source: 'char-miya-cafe', target: 'miya-cafe-1' },
                { edgeId: 'e-cafe-1', source: 'miya-cafe-1', target: 'yuki-cafe-1' },
                { edgeId: 'e-cafe-2', source: 'yuki-cafe-1', target: 'miya-cafe-2' },
                { edgeId: 'e-cafe-3', source: 'miya-cafe-2', target: 'yuki-cafe-2' },
                { edgeId: 'e-cafe-4', source: 'yuki-cafe-2', target: 'miya-cafe-3' },
                { edgeId: 'e-cafe-5', source: 'miya-cafe-3', target: 'yuki-cafe-3' },
                { edgeId: 'e-cafe-6', source: 'yuki-cafe-3', target: 'miya-cafe-4' },
                { edgeId: 'e-cafe-7', source: 'miya-cafe-4', target: 'yuki-cafe-4' },
                { edgeId: 'e-to-hide-miya', source: 'yuki-cafe-4', target: 'hide-miya' },
                { edgeId: 'e-to-starry', source: 'hide-miya', target: 'bg-starry-1' },
                // Scene 05
                { edgeId: 'e-starry-1', source: 'bg-starry-1', target: 'ren-starry-1' },
                { edgeId: 'e-starry-2', source: 'ren-starry-1', target: 'yuki-starry-1' },
                { edgeId: 'e-starry-3', source: 'yuki-starry-1', target: 'ren-starry-2' },
                { edgeId: 'e-starry-4', source: 'ren-starry-2', target: 'yuki-starry-2' },
                { edgeId: 'e-starry-5', source: 'yuki-starry-2', target: 'ren-starry-3' },
                { edgeId: 'e-starry-6', source: 'ren-starry-3', target: 'yuki-starry-3' },
                { edgeId: 'e-starry-7', source: 'yuki-starry-3', target: 'ren-starry-4' },
                { edgeId: 'e-to-editor', source: 'ren-starry-4', target: 'bg-empty-nodes' },
                // Scene 06
                { edgeId: 'e-editor-bg', source: 'bg-empty-nodes', target: 'ghost-editor-1' },
                { edgeId: 'e-editor-1', source: 'ghost-editor-1', target: 'ghost-editor-2' },
                { edgeId: 'e-editor-2', source: 'ghost-editor-2', target: 'input-name' },
                { edgeId: 'e-editor-3', source: 'input-name', target: 'ghost-editor-3' },
                { edgeId: 'e-to-sora', source: 'ghost-editor-3', target: 'bg-starry-2' },
                // Scene 07
                { edgeId: 'e-sora-bg', source: 'bg-starry-2', target: 'char-sora-born' },
                { edgeId: 'e-sora-char', source: 'char-sora-born', target: 'sora-1' },
                { edgeId: 'e-sora-1', source: 'sora-1', target: 'yuki-name-sora' },
                { edgeId: 'e-sora-2', source: 'yuki-name-sora', target: 'sora-2' },
                { edgeId: 'e-to-choice-b', source: 'sora-2', target: 'choice-b' },
                // 分支 A2
                { edgeId: 'e-choice-b-a', source: 'choice-b', target: 'branch-a2-yuki', label: '不会，我会帮你填满。' },
                { edgeId: 'e-branch-a2-1', source: 'branch-a2-yuki', target: 'branch-a2-sora' },
                { edgeId: 'e-branch-a2-2', source: 'branch-a2-sora', target: 'branch-a2-yuki-2' },
                { edgeId: 'e-branch-a2-end', source: 'branch-a2-yuki-2', target: 'sora-happy' },
                // 分支 B2
                { edgeId: 'e-choice-b-b', source: 'choice-b', target: 'branch-b2-yuki', label: '空不是缺少，而是可能。' },
                { edgeId: 'e-branch-b2-1', source: 'branch-b2-yuki', target: 'branch-b2-sora' },
                { edgeId: 'e-branch-b2-end', source: 'branch-b2-sora', target: 'sora-happy' },
                // 分支 C2
                { edgeId: 'e-choice-b-c', source: 'choice-b', target: 'branch-c2-yuki', label: '你可以自己选择。' },
                { edgeId: 'e-branch-c2-1', source: 'branch-c2-yuki', target: 'branch-c2-sora' },
                { edgeId: 'e-branch-c2-end', source: 'branch-c2-sora', target: 'sora-happy' },
                // End
                { edgeId: 'e-sora-happy', source: 'sora-happy', target: 'sora-end' },
                { edgeId: 'e-to-end', source: 'sora-end', target: 'bg-end' },
                { edgeId: 'e-end-1', source: 'bg-end', target: 'ghost-end-1' },
                { edgeId: 'e-end-2', source: 'ghost-end-1', target: 'ghost-end-2' },
                { edgeId: 'e-end-3', source: 'ghost-end-2', target: 'ghost-end-3' },
                { edgeId: 'e-end-choice-1', source: 'ghost-end-3', target: 'ghost-end-final', label: '创建我的第一个项目' },
                { edgeId: 'e-end-choice-2', source: 'ghost-end-3', target: 'ghost-end-final', label: '查看作品广场' },
                { edgeId: 'e-end-choice-3', source: 'ghost-end-3', target: 'ghost-end-final', label: '再读一遍' },
              ],
            },
          },
        ],
      },
    },
  })

  console.log('Seed created:', { user: user.username, projects: ['樱花下的初见', demoProject.title] })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
