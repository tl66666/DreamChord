import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

interface Track { id: string; name: string; description: string; mood: string; style: string; scene: string; loop: boolean; outputFile: string; sampleRate: number; durationSeconds: number; sha256: string }
interface Manifest { packId: string; source: string; sourceLicense: string; generatedAt: string; tracks: Track[] }

const prisma = new PrismaClient()
const prismaRoot = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(prismaRoot, '..')
const workspaceRoot = path.resolve(serverRoot, '..', '..')
dotenv.config({ path: path.join(serverRoot, '.env') })

async function main() {
  const manifestPath = path.join(workspaceRoot, 'assets', 'music-packs', 'dreamchord-starter', 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  if (!manifest.generatedAt || manifest.tracks.length !== 3) throw new Error('示例音乐清单尚未生成，请先运行 pnpm music:starter:generate')
  const user = await prisma.user.findUnique({ where: { username: 'demo' } })
  if (!user) throw new Error('未找到 demo 用户，请先运行 pnpm db:seed')
  const configuredUploadRoot = process.env.UPLOAD_DIR || './uploads'
  const uploadRoot = path.isAbsolute(configuredUploadRoot) ? configuredUploadRoot : path.resolve(serverRoot, configuredUploadRoot)
  const relativeDirectory = path.join('library', user.id, 'music-starter')
  const destinationDirectory = path.join(uploadRoot, relativeDirectory)
  mkdirSync(destinationDirectory, { recursive: true })

  for (const track of manifest.tracks) {
    const source = path.resolve(path.dirname(manifestPath), track.outputFile)
    if (!existsSync(source)) throw new Error(`缺少示例音乐：${source}`)
    const actualHash = createHash('sha256').update(readFileSync(source)).digest('hex')
    if (actualHash !== track.sha256) throw new Error(`${track.name} 的 SHA256 与清单不一致，拒绝导入`)
    const destination = path.join(destinationDirectory, `${track.id}.wav`)
    copyFileSync(source, destination)
    const url = `/uploads/${path.join(relativeDirectory, `${track.id}.wav`).replaceAll('\\', '/')}`
    const metadata = {
      audioLibrary: { mood: track.mood, style: track.style, scene: track.scene, loop: track.loop, license: `${manifest.sourceLicense} · DreamChord 原创程序化示例`, source: manifest.source },
      starterMusic: { packId: manifest.packId, generatedAt: manifest.generatedAt, sha256: track.sha256, sampleRate: track.sampleRate, durationSeconds: track.durationSeconds, description: track.description },
    }
    await prisma.asset.upsert({
      where: { id: `starter-music-${track.id}` },
      update: { ownerId: user.id, name: track.name, type: 'BGM', url, mimeType: 'audio/wav', metadata: JSON.stringify(metadata), status: 'ready' },
      create: { id: `starter-music-${track.id}`, ownerId: user.id, name: track.name, type: 'BGM', url, mimeType: 'audio/wav', metadata: JSON.stringify(metadata), status: 'ready' },
    })
    console.log(`✓ ${track.name} 已导入音乐库 (${track.durationSeconds.toFixed(1)}s)`)
  }
  console.log(`起始音乐同步完成：${manifest.tracks.length} 首，可安全重复执行。`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
