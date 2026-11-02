import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { SEVENTH_ROW_DEMO } from '../packages/story-domain/dist/index.js'

const root = resolve(import.meta.dirname, '..')
const pack = resolve(root, 'assets/voice-packs/seventh-row')
const manifestPath = resolve(pack, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const out = resolve(root, 'apps/web/public/assets/audio/seventh-row')
mkdirSync(out, { recursive: true })
const spoken = SEVENTH_ROW_DEMO.graph.nodes.filter(n => n.type === 'dialogue' && n.data.role !== '旁白')
for (const node of spoken) for (const locale of ['zh', 'ja']) {
  const id = `${node.id}-${locale}`
  const take = manifest.takes.find(t => t.id === id)
  const text = locale === 'zh' ? node.data.text : node.data.localizations.ja.text
  if (!take || take.text !== text || !/^[a-z0-9-]+\.wav$/.test(take.outputFile)) throw new Error(`Unfinished take: ${id}`)
  const wav = resolve(pack, take.outputFile)
  if (createHash('sha256').update(readFileSync(wav)).digest('hex') !== take.sha256) throw new Error(`Invalid source hash: ${id}`)
  const file = resolve(out, `${id}.ogg`)
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '24000', '-c:a', 'libvorbis', '-q:a', '5', file], { stdio: 'pipe' })
  take.runtimeFile = `/assets/audio/seventh-row/${id}.ogg`
  take.runtimeSha256 = createHash('sha256').update(readFileSync(file)).digest('hex')
}
manifest.runtimeEncoding = 'Ogg Vorbis q5, mono 24 kHz, -18 LUFS, -1.5 dBTP'
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Packaged ${spoken.length * 2} bilingual dialogue clips.`)
