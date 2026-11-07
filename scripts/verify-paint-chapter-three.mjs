import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..'), pack = resolve(root, 'assets/voice-packs/paint-chapter-three')
const read = file => readFileSync(file), json = file => JSON.parse(read(file).toString('utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const manifest = json(resolve(pack, 'manifest.json')), reviews = json(resolve(pack, 'asr-review.json'))
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg'
for (const take of manifest.takes) {
  if (hash(read(resolve(pack, take.outputFile))) !== take.sha256 || hash(read(resolve(root, 'apps/web/public' + take.runtimeFile))) !== take.runtimeSha256) throw Error('Take SHA mismatch: ' + take.id)
  if (!reviews.some(r => r.id === take.id && r.sha256 === take.sha256)) throw Error('Missing current ASR: ' + take.id)
  execFileSync(ffmpeg, ['-v', 'error', '-i', resolve(root, 'apps/web/public' + take.runtimeFile), '-f', 'null', '-'], { stdio: 'pipe' })
}
let previous = 0
for (const name of ['paint-prologue', 'paint-chapter-one', 'paint-chapter-two']) {
  // Read the committed prior manifest, not an editable current manifest.
  const old = JSON.parse(execFileSync('git', ['show', `HEAD:assets/voice-packs/${name}/manifest.json`], { cwd: root, encoding: 'utf8' }))
  for (const take of old.takes) {
    if (hash(read(resolve(root, `assets/voice-packs/${name}/${take.outputFile}`))) !== take.sha256) throw Error('Prior master changed: ' + take.id)
    if (!take.runtimeFile) continue // retained audition masters are not official dialogue tracks
    if (hash(read(resolve(root, 'apps/web/public' + take.runtimeFile))) !== take.runtimeSha256) throw Error('Prior runtime changed: ' + take.id)
    previous++
  }
}
const initialAsr = resolve(root, '.runtime/paint-chapter3-initial-asr.json')
const oldAsr = json(existsSync(initialAsr) ? initialAsr : resolve(pack, 'alternates-asr-review.json'))
writeFileSync(resolve(pack, 'alternates-asr-review.json'), JSON.stringify(oldAsr.filter(r => (manifest.alternates || []).some(t => t.sha256 === r.sha256)), null, 2) + '\n')
const report = {
  date: '2026-11-07', dialogueCount: manifest.takes.length,
  durationSeconds: Math.round(manifest.takes.reduce((s, t) => s + t.durationSeconds, 0) * 100) / 100,
  dialogueEngine: 'GPT-SoVITS v2ProPlus', trainedCharacterWeights: false,
  referenceCount: manifest.references.length, currentAsrCoverage: reviews.length,
  runtimeDecoding: { verified: manifest.takes.length, tool: 'ffmpeg', result: 'pass' },
  minimumRms: Math.min(...manifest.takes.map(t => t.rms)), sourcePeak: Math.max(...manifest.takes.map(t => t.peak)),
  clippedSourceSamples: reviews.reduce((s, r) => s + r.clippedSampleCount, 0),
  priorDialogueFilesUnchanged: previous, alternateTakeCount: (manifest.alternates || []).length,
  humanListeningCompleted: false,
  auxiliaryAsrFlags: reviews.filter(r => r.review === 'check').map(({ id, expected, recognized, sha256, similarity }) => ({ id, expected, recognized, sha256, similarity })),
  limitation: 'Text/SHA/decoding and ASR are technical evidence, not human pronunciation or acting acceptance. The April 20 rehearsal date line still needs human listening.',
}
writeFileSync(resolve(pack, 'technical-review.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ count: report.dialogueCount, seconds: report.durationSeconds, priorUnchanged: previous, asrFlags: report.auxiliaryAsrFlags.length }))
