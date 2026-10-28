import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

interface Track {
  id: string
  name: string
  description: string
  mood: string
  scenes: string[]
  role: string
  loop: boolean
  outputFile: string
  originalFile: string
  originalSha256: string
  tempoBpm: number
  musicalKey: string
  durationSeconds: number
  author: string
  sourceUrl: string
  license: string
  sha256: string
}
interface Manifest {
  packId: string
  author: string
  sourceUrl: string
  sourceLicense: string
  generativeAiUsed: boolean
  archiveSha256: string
  tracks: Track[]
}

const prisma = new PrismaClient()
const prismaRoot = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(prismaRoot, '..')
const workspaceRoot = path.resolve(serverRoot, '..', '..')
dotenv.config({ path: path.join(serverRoot, '.env') })

async function main() {
  const manifestPath = path.join(workspaceRoot, 'assets', 'music-packs', 'ternox-vn', 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  if (manifest.sourceLicense !== 'CC0-1.0' || manifest.generativeAiUsed || manifest.tracks.length < 9) {
    throw new Error('官方原声清单不完整，请先运行 pnpm music:official:install')
  }
  const user = await prisma.user.findUnique({ where: { username: 'demo' } })
  if (!user) throw new Error('未找到 demo 用户，请先运行 pnpm db:seed')
  const configuredUploadRoot = process.env.UPLOAD_DIR || './uploads'
  const uploadRoot = path.isAbsolute(configuredUploadRoot) ? configuredUploadRoot : path.resolve(serverRoot, configuredUploadRoot)
  const relativeDirectory = path.join('library', user.id, 'official-soundtrack')
  const destinationDirectory = path.join(uploadRoot, relativeDirectory)
  mkdirSync(destinationDirectory, { recursive: true })

  for (const track of manifest.tracks) {
    const source = path.resolve(path.dirname(manifestPath), track.outputFile)
    if (!existsSync(source)) throw new Error(`缺少示例音乐：${source}`)
    const actualHash = createHash('sha256').update(readFileSync(source)).digest('hex')
    if (actualHash !== track.sha256) throw new Error(`${track.name} 的 SHA256 与清单不一致，拒绝导入`)
    const destination = path.join(destinationDirectory, `${track.id}.ogg`)
    copyFileSync(source, destination)
    const url = `/uploads/${path.join(relativeDirectory, `${track.id}.ogg`).replaceAll('\\', '/')}`
    const metadata = {
      audioLibrary: {
        mood: track.mood,
        style: '视觉小说原声',
        scene: track.scenes.join(' / '),
        loop: track.loop,
        license: `${track.license} · ${track.author}`,
        source: track.sourceUrl,
      },
      officialSoundtrack: {
        packId: manifest.packId,
        role: track.role,
        sha256: track.sha256,
        originalFile: track.originalFile,
        originalSha256: track.originalSha256,
        archiveSha256: manifest.archiveSha256,
        tempoBpm: track.tempoBpm,
        musicalKey: track.musicalKey,
        durationSeconds: track.durationSeconds,
        description: track.description,
        generativeAiUsed: manifest.generativeAiUsed,
      },
    }
    await prisma.asset.upsert({
      where: { id: `official-music-${track.role}` },
      update: { ownerId: user.id, name: track.name, type: 'BGM', url, mimeType: 'audio/ogg', metadata: JSON.stringify(metadata), status: 'ready' },
      create: { id: `official-music-${track.role}`, ownerId: user.id, name: track.name, type: 'BGM', url, mimeType: 'audio/ogg', metadata: JSON.stringify(metadata), status: 'ready' },
    })
    console.log(`✓ ${track.name} · ${track.mood} (${track.durationSeconds.toFixed(1)}s)`)
  }

  const removed = await prisma.asset.deleteMany({
    where: {
      ownerId: user.id,
      id: {
        in: [
          'starter-music-dreamchord-twilight-corridor',
          'starter-music-dreamchord-rain-window',
          'starter-music-dreamchord-branch-pulse',
        ],
      },
    },
  })
  if (removed.count) console.log(`✓ 已从素材库移除 ${removed.count} 首旧的程序化占位音乐。`)
  console.log(`官方原声同步完成：${manifest.tracks.length} 首，可安全重复执行。`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
