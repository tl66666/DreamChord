import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { upgradePaintPrologue } from '../src/project/paintUpgrade.js'

const server = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(server, '.env') })
const client = new PrismaClient()

async function main() {
  const owner = await client.user.findUniqueOrThrow({ where: { username: 'demo' } })
  const result = await upgradePaintPrologue(client, owner.id)
  console.log(result.status === 'upgraded' ? '官方序章已升级；原项目、章节、角色和声音绑定保留。' : '官方序章已是当前版本，无需修改。')
  console.log(JSON.stringify(result, null, 2))
}
main().catch(error => {
  console.error('官方序章未升级。', error instanceof Error ? error.message : '请检查版本与媒体。')
  process.exitCode = 1
}).finally(() => client.$disconnect())
