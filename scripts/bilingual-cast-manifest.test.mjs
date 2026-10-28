import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pack = new URL('../assets/voice-packs/dreamchord-cast/', import.meta.url)
test('bilingual cast contains traceable matching reference and exact-script audio for all five roles', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', pack), 'utf8'))
  assert.equal(manifest.sourceModel, 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice')
  assert.equal(manifest.sourceLicense, 'Apache-2.0')
  assert.equal(manifest.syntheticSource, true)
  assert.equal(manifest.voices.length, 5)
  assert.equal(new Set(manifest.takes.map((take) => take.id)).size, manifest.takes.length)
  for (const role of ['yuki', 'ren', 'miya', 'sora', 'ghost']) {
    const references = manifest.takes.filter((take) => take.role === role && take.isReference)
    assert.deepEqual(new Set(references.map((take) => take.language)), new Set(['zh', 'ja']))
    assert.equal(new Set(references.map((take) => take.speaker)).size, 1)
  }
  for (const take of manifest.takes) {
    assert.match(take.outputFile, /^generated\/[a-z0-9-]+\.wav$/)
    const bytes = readFileSync(new URL(take.outputFile, pack))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), take.sha256)
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF')
    assert.ok(take.durationSeconds > 0.5 && take.durationSeconds < 45)
    assert.ok(take.text.trim())
    assert.ok(take.rms > 0.001)
  }
})
