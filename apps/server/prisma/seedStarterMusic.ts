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
  originalFile?: string
  originalSha256?: string
  tempoBpm?: number
  musicalKey?: string
  durationSeconds: number
  author: string
  sourceUrl: string
  license: string
  sha256: string
}
interface SfxEntry {
  id: string
  role: string
  name: string
  description: string
  mood: string
  scenes: string[]
  outputFile: string
  loop?: boolean
  durationSeconds: number
  author: string
  sourceUrl: string
  license: string
  sha256: string
}
interface MusicPackManifest {
  schemaVersion?: number
  packId: string
  displayName?: string
  sourceLicense?: string
  generativeAiUsed: boolean
  archiveSha256?: string
  tracks: Track[]
  sfx?: SfxEntry[]
}
interface PackConfig {
  directory: string
  audioStyle: string
  strict: boolean
}

const PACKS: PackConfig[] = [
  { directory: 'ternox-vn', audioStyle: '视觉小说原声', strict: true },
  { directory: 'community-vn', audioStyle: '社区原声集', strict: false },
]

const prisma = new PrismaClient()
const prismaRoot = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(prismaRoot, '..')
const workspaceRoot = path.resolve(serverRoot, '..', '..')
dotenv.config({ path: path.join(serverRoot, '.env') })

function sha256(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

async function importTrack(pack: PackConfig, manifest: MusicPackManifest, manifestPath: string, track: Track, uploadRoot: string, user: { id: string }) {
  const source = path.resolve(path.dirname(manifestPath), track.outputFile)
  if (!existsSync(source)) throw new Error(`缺少示例音乐：${source}`)
  const actualHash = sha256(source)
  if (actualHash !== track.sha256) throw new Error(`${track.name} 的 SHA256 与清单不一致，拒绝导入`)
  const relativeDirectory = path.join('library', user.id, 'official-soundtrack')
  const destinationDirectory = path.join(uploadRoot, relativeDirectory)
  const destination = path.join(destinationDirectory, `${track.id}.ogg`)
  copyFileSync(source, destination)
  const url = `/uploads/${path.join(relativeDirectory, `${track.id}.ogg`).replaceAll('\\', '/')}`
  const metadata = {
    audioLibrary: {
      mood: track.mood,
      style: pack.audioStyle,
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
  console.log(`✓ [${pack.directory}] ${track.name} · ${track.mood} (${track.durationSeconds.toFixed(1)}s)`)
}

async function importSfx(pack: PackConfig, manifest: MusicPackManifest, entry: SfxEntry, uploadRoot: string, user: { id: string }) {
  const source = path.resolve(path.dirname(path.join(workspaceRoot, 'assets', 'music-packs', pack.directory, 'manifest.json')), entry.outputFile)
  if (!existsSync(source)) throw new Error(`缺少示例音效：${source}`)
  const actualHash = sha256(source)
  if (actualHash !== entry.sha256) throw new Error(`${entry.name} 的 SHA256 与清单不一致，拒绝导入`)
  const relativeDirectory = path.join('library', user.id, 'official-soundtrack-sfx')
  const destinationDirectory = path.join(uploadRoot, relativeDirectory)
  mkdirSync(destinationDirectory, { recursive: true })
  const destination = path.join(destinationDirectory, `${entry.id}.ogg`)
  copyFileSync(source, destination)
  const url = `/uploads/${path.join(relativeDirectory, `${entry.id}.ogg`).replaceAll('\\', '/')}`
  const metadata = {
    audioLibrary: {
      mood: entry.mood,
      style: '环境音效',
      scene: entry.scenes.join(' / '),
      loop: entry.loop ?? false,
      license: `${entry.license} · ${entry.author}`,
      source: entry.sourceUrl,
    },
    officialSoundtrack: {
      packId: manifest.packId,
      role: entry.role,
      sha256: entry.sha256,
      durationSeconds: entry.durationSeconds,
      description: entry.description,
      generativeAiUsed: manifest.generativeAiUsed,
    },
  }
  await prisma.asset.upsert({
    where: { id: `official-sfx-${entry.role}` },
    update: { ownerId: user.id, name: entry.name, type: 'SFX', url, mimeType: 'audio/ogg', metadata: JSON.stringify(metadata), status: 'ready' },
    create: { id: `official-sfx-${entry.role}`, ownerId: user.id, name: entry.name, type: 'SFX', url, mimeType: 'audio/ogg', metadata: JSON.stringify(metadata), status: 'ready' },
  })
  console.log(`✓ [${pack.directory}] SFX ${entry.name} · ${entry.mood} (${entry.durationSeconds.toFixed(1)}s)`)
}

async function main() {
  const user = await prisma.user.findUnique({ where: { username: 'demo' } })
  if (!user) throw new Error('未找到 demo 用户，请先运行 pnpm db:seed')
  const configuredUploadRoot = process.env.UPLOAD_DIR || './uploads'
  const uploadRoot = path.isAbsolute(configuredUploadRoot) ? configuredUploadRoot : path.resolve(serverRoot, configuredUploadRoot)

  let importedTracks = 0
  let importedSfx = 0
  for (const pack of PACKS) {
    const manifestPath = path.join(workspaceRoot, 'assets', 'music-packs', pack.directory, 'manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as MusicPackManifest
    if (pack.strict) {
      if (manifest.sourceLicense !== 'CC0-1.0' || manifest.tracks.length < 9) {
        throw new Error('官方原声清单不完整，请先运行 pnpm music:official:install')
      }
    } else if ((manifest.schemaVersion ?? 1) !== 1) {
      throw new Error(`素材包 ${pack.directory} 的 schemaVersion 不受支持`)
    }
    if (manifest.generativeAiUsed) throw new Error(`素材包 ${pack.directory} 声明使用了生成式 AI，拒绝导入`)
    if (!Array.isArray(manifest.tracks) || manifest.tracks.length < 1) throw new Error(`素材包 ${pack.directory} 缺少曲目`)
    for (const track of manifest.tracks) {
      await importTrack(pack, manifest, manifestPath, track, uploadRoot, user)
      importedTracks += 1
    }
    for (const entry of manifest.sfx ?? []) {
      await importSfx(pack, manifest, entry, uploadRoot, user)
      importedSfx += 1
    }
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
  console.log(`官方/社区原声同步完成：${importedTracks} 首 BGM、${importedSfx} 条音效，可安全重复执行。`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
