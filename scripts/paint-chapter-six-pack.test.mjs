import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { PAINT_CHAPTER_SIX } from '../packages/story-domain/dist/index.js'
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
test('sixth chapter art and Japanese voice files are present and traceable', () => {
  const art = JSON.parse(readFileSync('source-assets/paint-chapter-six/art-manifest.json', 'utf8'))
  for (const item of art.assets) { assert.equal(hash(item.nativeFile), item.nativeSha256); assert.equal(hash(item.publicFile), item.publicSha256) }
  const review = JSON.parse(readFileSync('assets/voice-packs/paint-chapter-six/asr-review.json', 'utf8'))
  const lines = PAINT_CHAPTER_SIX.graph.nodes.filter(node => node.type === 'dialogue')
  assert.equal(lines.length, 21)
  for (const line of lines) {
    assert.ok(existsSync('apps/web/public' + line.data.voiceTracks.ja.url), line.id)
    const item = review.find(entry => entry.id === line.id + '-ja')
    assert.ok(item, line.id)
    assert.equal(item.clippedSampleCount, 0, line.id)
    assert.equal(item.humanListeningCompleted, false)
  }
})
