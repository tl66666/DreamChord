import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const manifestUrl = new URL('../assets/voice-packs/dreamchord-starter/manifest.json', import.meta.url)

test('DreamChord starter pack contains exactly three traceable synthetic Mandarin voices', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'))
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.sourceModel, 'hexgrad/Kokoro-82M')
  assert.equal(manifest.sourceLicense, 'Apache-2.0')
  assert.equal(manifest.syntheticSource, true)

  assert.deepEqual(
    manifest.voices.map((voice) => voice.id),
    ['dreamchord-xingli', 'dreamchord-wulan', 'dreamchord-muchuan'],
  )
  assert.equal(new Set(manifest.voices.map((voice) => voice.sourceVoiceId)).size, 3)

  for (const voice of manifest.voices) {
    assert.match(voice.name, /^.+・.+$/)
    assert.match(voice.transcript, /[\u3400-\u9fff]/)
    assert.ok(voice.transcript.length >= 35)
    assert.match(voice.sourceVoiceId, /^(zf|zm)_/)
    assert.match(voice.outputFile, /^generated\/[a-z0-9-]+\.wav$/)
    assert.ok(voice.sha256 === null || /^[a-f\d]{64}$/.test(voice.sha256))
    assert.ok(voice.durationSeconds === null || (voice.durationSeconds >= 3 && voice.durationSeconds <= 30))
  }
})

