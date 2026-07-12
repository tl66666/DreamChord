import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { refreshOfficialDemo } from '../src/demo/officialDemoSeed.js'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      email: 'demo@dreamchord.app',
      username: 'demo',
      nickname: '梦弦官方',
      password: await bcrypt.hash('demo123', 10),
    },
  })

  await prisma.project.upsert({
    where: { id: 'sakura-story' },
    update: { isPublic: true, isPublished: true },
    create: {
      id: 'sakura-story',
      title: '樱花下的初见',
      description: '一个关于青春与重逢的短篇视觉小说',
      cover: '/assets/covers/sakura-story.png',
      isPublic: true,
      isPublished: true,
      authorId: user.id,
      chapters: { create: {
        title: '第一章：重逢',
        order: 0,
        nodes: { create: [
          { nodeId: 'sakura-bg', type: 'background', positionX: 100, positionY: 100, data: JSON.stringify({ backgroundId: 'bg-sakura', sceneGroupId: 'sakura-scene-1', sceneCode: '1-1', sceneTitle: '樱花树下' }) },
          { nodeId: 'sakura-yuki', type: 'character', positionX: 260, positionY: 100, data: JSON.stringify({ characterId: 'yuki', action: 'show', expression: 'surprised', position: 'left', sceneGroupId: 'sakura-scene-1', sceneCode: '1-1', sceneTitle: '樱花树下' }) },
          { nodeId: 'sakura-ren', type: 'character', positionX: 420, positionY: 100, data: JSON.stringify({ characterId: 'ren', action: 'show', expression: 'normal', position: 'right', sceneGroupId: 'sakura-scene-1', sceneCode: '1-1', sceneTitle: '樱花树下' }) },
          { nodeId: 'sakura-d1', type: 'dialogue', positionX: 580, positionY: 100, data: JSON.stringify({ role: 'yuki', text: '等等……我们是不是在哪里见过？', sceneGroupId: 'sakura-scene-1', sceneCode: '1-1', sceneTitle: '樱花树下' }) },
          { nodeId: 'sakura-choice', type: 'choice', positionX: 740, positionY: 100, data: JSON.stringify({ choices: ['叫住他', '先观察一下'], sceneGroupId: 'sakura-scene-1', sceneCode: '1-1', sceneTitle: '樱花树下' }) },
          { nodeId: 'sakura-a', type: 'dialogue', positionX: 900, positionY: 40, data: JSON.stringify({ role: 'ren', text: '你终于想起我了。', sceneGroupId: 'sakura-scene-1', sceneCode: '1-1', sceneTitle: '樱花树下' }) },
          { nodeId: 'sakura-b', type: 'dialogue', positionX: 900, positionY: 180, data: JSON.stringify({ role: 'yuki', text: '那道背影，让我想起了很久以前的约定。', sceneGroupId: 'sakura-scene-1', sceneCode: '1-1', sceneTitle: '樱花树下' }) },
        ] },
        edges: { create: [
          { edgeId: 'sakura-e1', source: 'sakura-bg', target: 'sakura-yuki', animated: true },
          { edgeId: 'sakura-e2', source: 'sakura-yuki', target: 'sakura-ren', animated: true },
          { edgeId: 'sakura-e3', source: 'sakura-ren', target: 'sakura-d1', animated: true },
          { edgeId: 'sakura-e4', source: 'sakura-d1', target: 'sakura-choice', animated: true },
          { edgeId: 'sakura-e5', source: 'sakura-choice', target: 'sakura-a', sourceHandle: 'choice-0', label: '叫住他', animated: true },
          { edgeId: 'sakura-e6', source: 'sakura-choice', target: 'sakura-b', sourceHandle: 'choice-1', label: '先观察一下', animated: true },
        ] },
      } },
    },
  })

  const official = await refreshOfficialDemo(prisma, user.id)
  console.log('Seed created:', { user: user.username, projects: ['樱花下的初见', official.title] })
}

main()
  .catch((error) => { console.error(error); process.exit(1) })
  .finally(async () => prisma.$disconnect())
