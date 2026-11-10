import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { PAINT_CHAPTER_FOUR } from '../packages/story-domain/dist/index.js'
import { PAINT_CHAPTER_FOUR_LINES } from '../packages/story-domain/dist/paintChapterFourLines.js'

const root = new URL('../', import.meta.url)
const read = file => readFileSync(new URL(file, root))
const json = file => JSON.parse(read(file).toString('utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('fourth chapter ships all authored dialogue with verified references and current reviews', () => {
  const manifest = json('assets/voice-packs/paint-chapter-four/manifest.json')
  const old = json('assets/voice-packs/paint-prologue/manifest.json')
  const reviews = json('assets/voice-packs/paint-chapter-four/asr-review.json')
  assert.equal(manifest.chapterTitle, PAINT_CHAPTER_FOUR.chapterTitle)
  assert.equal(manifest.packagedDialogueCount, PAINT_CHAPTER_FOUR_LINES.length)
  assert.equal(PAINT_CHAPTER_FOUR_LINES.length, 36)
  assert.equal(manifest.humanListeningCompleted, false)
  for (const ref of manifest.references) {
    assert.equal(hash(read(`assets/voice-packs/paint-chapter-four/${ref.outputFile}`)), ref.sha256)
    const original = old.references.find(item => item.id === ref.id)
    if (original) assert.equal(ref.sha256, original.sha256)
  }
  for (const line of PAINT_CHAPTER_FOUR_LINES) {
    const take = manifest.takes.find(item => item.nodeId === line.id)
    assert.ok(take, line.id)
    assert.equal(take.text, line.ja)
    assert.equal(hash(read(`assets/voice-packs/paint-chapter-four/${take.outputFile}`)), take.sha256)
    assert.equal(hash(read(`apps/web/public${take.runtimeFile}`)), take.runtimeSha256)
    assert.ok(reviews.some(review => review.id === take.id && review.sha256 === take.sha256), line.id)
  }
})
