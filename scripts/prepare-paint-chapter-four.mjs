/** Prepare a new six-role pack; never overwrite original actors or generated takes. */
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = new URL('../', import.meta.url), folder = 'assets/voice-packs/paint-chapter-four/'
const read = file => readFile(new URL(file, root)), sha = b => createHash('sha256').update(b).digest('hex')
await mkdir(new URL(folder, root), { recursive: true })
await mkdir(new URL('.runtime/', root), { recursive: true })
const original = JSON.parse(await read('assets/voice-packs/paint-prologue/manifest.json'))
for (const ref of original.references) {
  const bytes = await read(`assets/voice-packs/paint-prologue/${ref.outputFile}`)
  if (sha(bytes) !== ref.sha256) throw Error('Original actor reference mismatch')
  const destination = new URL(folder + ref.outputFile, root)
  let existing
  try { existing = await readFile(destination) } catch (e) { if (e.code !== 'ENOENT') throw e }
  if (existing && sha(existing) !== ref.sha256) throw Error('Existing actor reference was edited')
  if (!existing) await copyFile(new URL(`assets/voice-packs/paint-prologue/${ref.outputFile}`, root), destination)
}
const file = new URL(folder + 'manifest.json', root)
let manifest
try { manifest = JSON.parse(await readFile(file, 'utf8')) } catch (e) { if (e.code !== 'ENOENT') throw e }
if (manifest) {
  if (manifest.packId !== 'paint-chapter-four' || original.references.some(r => !manifest.references.some(o => o.id === r.id && o.sha256 === r.sha256))) throw Error('Existing original references changed')
} else {
  manifest = { schemaVersion: 1, packId: 'paint-chapter-four', chapterTitle: '第四章 · 在画纸之外落笔', createdAt: '2026-11-09', referenceModel: original.referenceModel, referenceLicense: original.referenceLicense, referenceSource: original.referenceSource, identityNotice: original.identityNotice, voices: [...original.voices,
    { id: 'liu', role: '刘济安', name: '刘叔 · 朴实温厚', speaker: 'Uncle_Fu', genderTone: '男声', description: '58岁木匠的自然会话，低沉温厚，话说得短，有一点干幽默，不夸张扮老。' },
    { id: 'shen', role: '沈芸', name: '沈芸 · 明快从容', speaker: 'Vivian', genderTone: '女声', description: '49岁女性，明快务实、从容亲近，音域适度降低，提醒人时不训话，不使用少女卖萌腔。' },
  ], references: original.references, takes: [], trainedCharacterWeights: false, humanListeningCompleted: false }
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n')
}
if (!process.argv.includes('--references-only')) {
  const { PAINT_CHAPTER_FOUR_LINES } = await import('../packages/story-domain/dist/paintChapterFourLines.js')
  await writeFile(new URL('.runtime/paint-chapter4-script.json', root), JSON.stringify(PAINT_CHAPTER_FOUR_LINES, null, 2) + '\n')
  console.log(`Prepared ${PAINT_CHAPTER_FOUR_LINES.length} lines; original references and existing takes preserved.`)
} else console.log('Prepared six-role manifest and exact original references; dialogue export deferred.')
