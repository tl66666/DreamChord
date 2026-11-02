import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { seedPaintPrologue } from '../src/demo/paintPrologueSeed.js'

const server = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(server, '.env') })
const client = new PrismaClient()

async function main() {
  const owner = await client.user.findUniqueOrThrow({ where: { username: 'demo' } })
  const existed = await client.project.findUnique({ where: { id: 'dreamchord-paint-prologue' } })
  const project = await seedPaintPrologue(client, owner.id, { storageRoot: path.resolve(server, process.env.UPLOAD_DIR || './uploads') })
  console.log(existed ? `${project.title}：已有项目保留，未修改内容、角色或音色。` : `${project.title}：序章、日语对白、角色音色与配乐已完整安装。`)
}
main().catch(error => {
  console.error('序章安装失败；未创建不完整的项目。', error instanceof Error ? error.message : '请检查官方媒体包。')
  process.exitCode = 1
}).finally(() => client.$disconnect())
