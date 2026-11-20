import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PAINT_CHAPTER_SIX, PAINT_CHAPTER_SIX_LINES } from '../packages/story-domain/dist/index.js'

const root = new URL('../', import.meta.url), folder = 'assets/voice-packs/paint-chapter-six/'
const read = file => readFile(new URL(file, root)), sha = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(new URL(folder, root), { recursive: true })
await mkdir(new URL('.runtime/', root), { recursive: true })
const old = JSON.parse(await read('assets/voice-packs/paint-chapter-five/manifest.json'))
for (const ref of old.references) {
  const bytes = await read(`assets/voice-packs/paint-chapter-five/${ref.outputFile}`)
  if (sha(bytes) !== ref.sha256) throw Error(`Original reference mismatch: ${ref.id}`)
  const target = new URL(folder + ref.outputFile, root)
  let existing
  try { existing = await readFile(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (existing && sha(existing) !== ref.sha256) throw Error(`Existing reference changed: ${ref.id}`)
  if (!existing) await copyFile(new URL(`assets/voice-packs/paint-chapter-five/${ref.outputFile}`, root), target)
}
const file = new URL(folder + 'manifest.json', root)
let manifest
try { manifest = JSON.parse(await readFile(file, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
if (manifest) {
  if (manifest.packId !== 'paint-chapter-six' || old.references.some(ref => !manifest.references.some(item => item.id === ref.id && item.sha256 === ref.sha256))) throw Error('Existing cast references changed')
} else {
  manifest = { schemaVersion: 1, packId: 'paint-chapter-six', chapterTitle: PAINT_CHAPTER_SIX.chapterTitle, createdAt: '2026-11-20', referenceModel: old.referenceModel, referenceLicense: old.referenceLicense, referenceSource: old.referenceSource, identityNotice: old.identityNotice, voices: old.voices, references: old.references, takes: [], trainedCharacterWeights: false, humanListeningCompleted: false }
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n')
}
await writeFile(new URL('.runtime/paint-chapter6-script.json', root), JSON.stringify(PAINT_CHAPTER_SIX_LINES, null, 2) + '\n')
console.log(`Prepared ${PAINT_CHAPTER_SIX_LINES.length} dialogue lines with preserved references.`)
