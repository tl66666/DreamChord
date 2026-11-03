import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from '../apps/server/node_modules/sharp/lib/index.js'
import { PAINT_CHAPTER_ONE, PAINT_CHAPTER_ONE_LINES } from '../packages/story-domain/dist/index.js'
const root = new URL('../', import.meta.url)
const read = file => readFileSync(new URL(file, root))
const json = file => JSON.parse(read(file).toString('utf8'))
const hash = value => createHash('sha256').update(value).digest('hex')

test('all 68 chapter takes match the exact authored Japanese and existing reference identities', () => {
  const m = json('assets/voice-packs/paint-chapter-one/manifest.json')
  const old = json('assets/voice-packs/paint-prologue/manifest.json')
  assert.equal(m.dialogueEngine, 'GPT-SoVITS')
  assert.equal(m.trainedCharacterWeights, false)
  assert.equal(m.humanListeningCompleted, false)
  assert.equal(m.packagedDialogueCount, PAINT_CHAPTER_ONE_LINES.length)
  for (const ref of m.references) {
    assert.equal(ref.sha256, old.references.find(r => r.id === ref.id)?.sha256)
    assert.equal(hash(read(`assets/voice-packs/paint-chapter-one/${ref.outputFile}`)), ref.sha256)
  }
  const review = json('assets/voice-packs/paint-chapter-one/asr-review.json')
  for (const line of PAINT_CHAPTER_ONE_LINES) {
    const take = m.takes.find(t => t.nodeId === line.id)
    assert.ok(take, line.id)
    assert.equal(take.text, line.ja)
    assert.equal(hash(read(`assets/voice-packs/paint-chapter-one/${take.outputFile}`)), take.sha256)
    assert.equal(hash(read(`apps/web/public${take.runtimeFile}`)), take.runtimeSha256)
    assert.ok(review.some(r => r.id === take.id && r.sha256 === take.sha256), `Current ASR coverage ${line.id}`)
    assert.ok(take.durationSeconds > .25 && take.rms > .002)
  }
})
test('all six narrative backgrounds retain original provenance and full-width framing', async () => {
  const m = json('source-assets/paint-chapter-one/art-manifest.json')
  assert.equal(m.assets.length, 6)
  for (const a of m.assets) {
    assert.ok(a.prompt)
    assert.equal(hash(read(a.nativeFile)), a.native.sha256)
    assert.equal(hash(read(a.sourceFile)), a.sourceSha256)
    const bytes = read(a.publicFile)
    assert.equal(hash(bytes), a.publicSha256)
    const meta = await sharp(bytes).metadata()
    assert.equal(meta.width, 1920); assert.equal(meta.height, 1080)
    assert.equal(a.adaptation.cropped, false)
  }
  for (const n of PAINT_CHAPTER_ONE.graph.nodes.filter(n => n.type === 'background')) assert.ok(read(`apps/web/public${n.data.backgroundId}`).length > 0)
})
