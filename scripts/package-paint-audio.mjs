/** Package exactly the current Japanese script, rejecting missing/stale WAVs. */
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'

const root = resolve(import.meta.dirname, '..')
const { values } = parseArgs({ options: { pack: { type: 'string', default: 'paint-prologue' }, script: { type: 'string', default: '.runtime/paint-script.json' } } })
const packId = values.pack
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packId)) throw new Error('--pack must be a safe lowercase directory id')
const pack = resolve(root, 'assets/voice-packs', packId)
const manifestPath = resolve(pack, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (manifest.packId !== packId) throw new Error('Manifest packId does not match --pack')
const script = JSON.parse(readFileSync(resolve(root, values.script), 'utf8').replace(/^\uFEFF/, ''))
const output = resolve(root, 'apps/web/public/assets/audio', packId)
const ffmpeg = process.env.FFMPEG_PATH || (existsSync('D:/DreamChordRuntime/ffmpeg/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe') ? 'D:/DreamChordRuntime/ffmpeg/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe' : 'ffmpeg')
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
mkdirSync(output, { recursive: true })
let count = 0
for (const line of script.filter(line => line.ja && line.role)) {
  const id = `${line.id}-ja`, take = manifest.takes.find(take => take.id === id)
  if (!take || take.text !== line.ja.trim() || !/^[a-z0-9-]+\.wav$/.test(take.outputFile)) throw new Error(`Missing or stale take: ${id}`)
  const source = resolve(pack, take.outputFile)
  if (hash(source) !== take.sha256) throw new Error(`WAV checksum mismatch: ${id}`)
  const target = resolve(output, `${id}.ogg`)
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '24000', '-c:a', 'libvorbis', '-q:a', '5', target], { stdio: 'pipe' })
  take.runtimeFile = `/assets/audio/${packId}/${id}.ogg`
  take.runtimeSha256 = hash(target)
  count += 1
}
manifest.runtimeEncoding = 'Ogg Vorbis q5, mono 24 kHz, -18 LUFS, -1.5 dBTP'
manifest.packagedDialogueCount = count
const checkpoint = `${manifestPath}.package-${process.pid}.tmp`
writeFileSync(checkpoint, JSON.stringify(manifest, null, 2) + '\n')
renameSync(checkpoint, manifestPath)
console.log(`Verified and packaged ${count} Japanese dialogue clips.`)
