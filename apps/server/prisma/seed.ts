import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { refreshOfficialDemo } from '../src/demo/officialDemoSeed.js'
import { seedSeventhRow } from '../src/demo/seventhRowSeed.js'
import { seedCurtainCall } from '../src/demo/curtainCallSeed.js'

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

  // The retired sakura skeleton is not recreated; author-edited projects remain.
  const official = await refreshOfficialDemo(prisma, user.id)
  await seedSeventhRow(prisma, user.id)
  await seedCurtainCall(prisma, user.id)
  console.log('Seed created:', { user: user.username, projects: ['樱花下的初见', official.title] })
}

main()
  .catch((error) => { console.error(error); process.exit(1) })
  .finally(async () => prisma.$disconnect())
