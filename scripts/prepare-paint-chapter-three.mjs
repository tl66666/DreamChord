import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PAINT_CHAPTER_THREE_LINES } from '../packages/story-domain/dist/paintChapterThreeLines.js'
const root = new URL('../', import.meta.url), folder = 'assets/voice-packs/paint-chapter-three/'
const read = file => readFile(new URL(file, root))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(new URL(folder, root), { recursive: true })
await mkdir(new URL('.runtime/', root), { recursive: true })
await writeFile(new URL('.runtime/paint-chapter3-script.json', root), JSON.stringify(PAINT_CHAPTER_THREE_LINES, null, 2) + '\n')
const old = JSON.parse(await read('assets/voice-packs/paint-prologue/manifest.json'))
for (const ref of old.references) {
  const bytes = await read(`assets/voice-packs/paint-prologue/${ref.outputFile}`)
  if (sha(bytes) !== ref.sha256) throw Error('Original actor reference mismatch')
  const destination = new URL(folder + ref.outputFile, root)
  let existingBytes
  try { existingBytes = await readFile(destination) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (existingBytes && sha(existingBytes) !== ref.sha256) throw Error('Existing actor reference was edited; refusing overwrite')
  if (!existingBytes) await copyFile(new URL(`assets/voice-packs/paint-prologue/${ref.outputFile}`, root), destination)
}
const target = new URL(folder + 'manifest.json', root)
let existing
try { existing = JSON.parse(await readFile(target, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
if (existing) {
  if (existing.packId !== 'paint-chapter-three' || existing.references.some(r => !old.references.some(o => o.id === r.id && o.sha256 === r.sha256))) throw Error('Existing reference identity changed')
  console.log('Existing voice manifest preserved; script and exact original references checked.')
} else {
  const manifest = { schemaVersion: 1, packId: 'paint-chapter-three', chapterTitle: '第三章 · 风从夏日手记吹来', createdAt: '2026-11-07', referenceModel: old.referenceModel, referenceLicense: old.referenceLicense, referenceSource: old.referenceSource, identityNotice: old.identityNotice, voices: old.voices, references: old.references, takes: [], trainedCharacterWeights: false, humanListeningCompleted: false }
  await writeFile(target, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Prepared ${PAINT_CHAPTER_THREE_LINES.length} lines with ${old.references.length} unchanged original references.`)
}
