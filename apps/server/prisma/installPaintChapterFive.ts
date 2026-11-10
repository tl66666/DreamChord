import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PAINT_PROLOGUE, PAINT_CHAPTER_ONE, PAINT_CHAPTER_TWO, PAINT_CHAPTER_THREE, PAINT_CHAPTER_FOUR, PAINT_CHAPTER_FIVE } from '@dreamchord/story-domain'
import { releasePaintBook } from '../src/project/paintBookRelease.js'
import type { PaintDefinition } from '../src/project/paintTemplate.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
dotenv.config({ path: path.join(root, 'apps/server/.env') })
const client = new PrismaClient()
async function main() {
  const args = process.argv.slice(2)
  if (args.some(arg => !['--check', '--apply'].includes(arg)) || (args.includes('--check') && args.includes('--apply'))) throw Error('用法：installPaintChapterFive.ts [--check | --apply]；默认仅预检。')
  const owner = await client.user.findUniqueOrThrow({ where: { username: 'demo' } })
  const baseline = JSON.parse(await readFile(path.join(root, 'assets/story-packs/paint-book/release-five-chapters-v1.json'), 'utf8')) as { chapters: PaintDefinition[] }
  const result = await releasePaintBook(client, owner.id, {
    checkOnly: !args.includes('--apply'), releaseDefinitions: baseline.chapters,
    currentDefinitions: [PAINT_PROLOGUE, PAINT_CHAPTER_ONE, PAINT_CHAPTER_TWO, PAINT_CHAPTER_THREE, PAINT_CHAPTER_FOUR, PAINT_CHAPTER_FIVE],
    packRoots: ['paint-prologue', 'paint-chapter-one', 'paint-chapter-two', 'paint-chapter-three', 'paint-chapter-four', 'paint-chapter-five'].map(name => path.join(root, 'assets/voice-packs', name)),
  })
  console.log(JSON.stringify(result, null, 2))
}
main().catch(error => { console.error(error instanceof Error ? error.message : '第五章发布失败'); process.exitCode = 1 }).finally(() => client.$disconnect())
