import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { releasePaintBook } from '../src/project/paintBookRelease.js'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') })
const client = new PrismaClient()
async function main() {
  if (process.argv.slice(2).some(arg => !['--check', '--apply'].includes(arg)) || (process.argv.includes('--check') && process.argv.includes('--apply'))) throw new Error('用法：tsx prisma/releasePaintBook.ts [--check | --apply]；默认仅预检。')
  const owner = await client.user.findUniqueOrThrow({ where: { username: 'demo' } })
  console.log(JSON.stringify(await releasePaintBook(client, owner.id, { checkOnly: !process.argv.includes('--apply') }), null, 2))
}
main().catch(error => { console.error(error instanceof Error ? error.message : '发布失败'); process.exitCode = 1 }).finally(() => client.$disconnect())
