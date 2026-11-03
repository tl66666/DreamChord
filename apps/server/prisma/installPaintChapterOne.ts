import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { installPaintChapterOne } from '../src/project/paintChapterInstall.js'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') })
const client = new PrismaClient()
async function main() {
  const owner = await client.user.findUniqueOrThrow({ where: { username: 'demo' } })
  console.log(JSON.stringify(await installPaintChapterOne(client, owner.id), null, 2))
}
main().catch(error => { console.error(error instanceof Error ? error.message : '安装失败'); process.exitCode = 1 }).finally(() => client.$disconnect())
