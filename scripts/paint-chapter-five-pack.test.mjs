import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { PAINT_CHAPTER_FIVE } from '../packages/story-domain/dist/index.js'
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
test('fifth chapter packaged art and voice tracks remain present and identifiable', () => {
  const art = JSON.parse(readFileSync('source-assets/paint-chapter-five/art-manifest.json', 'utf8'))
  for (const item of art.assets) { assert.equal(hash(item.nativeFile), item.nativeSha256); assert.equal(hash(item.publicFile), item.publicSha256) }
  const review = JSON.parse(readFileSync('assets/voice-packs/paint-chapter-five/asr-review.json', 'utf8'))
  const lines = PAINT_CHAPTER_FIVE.graph.nodes.filter(node => node.type === 'dialogue')
  assert.equal(lines.length, 24)
  for (const line of lines) {
    const audio = 'apps/web/public' + line.data.voiceTracks.ja.url
    assert.ok(existsSync(audio), audio)
    const entry = review.find(item => item.id === line.id + '-ja')
    assert.ok(entry, line.id)
    assert.equal(entry.clippedSampleCount, 0, line.id)
    assert.equal(entry.humanListeningCompleted, false)
  }
})
