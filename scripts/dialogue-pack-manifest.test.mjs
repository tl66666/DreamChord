import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pack = new URL('../assets/voice-packs/dreamchord-dialogue/', import.meta.url)
test('dialogue pack contains bilingual original-line auditions for every voice', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', pack), 'utf8'))
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.packId, 'dreamchord-dialogue')
  assert.equal(manifest.sourceModel, 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice')
  assert.equal(manifest.sourceLicense, 'Apache-2.0')
  assert.equal(manifest.syntheticSource, true)
  assert.equal(manifest.voices.length, 4)
  assert.equal(manifest.takes.length, 24)
  assert.equal(new Set(manifest.takes.map((take) => take.id)).size, manifest.takes.length)
  for (const voice of manifest.voices) {
    const takes = manifest.takes.filter((take) => take.role === voice.id)
    assert.equal(takes.filter((take) => take.language === 'zh').length, 3, `${voice.id} 中文样音应为 3 条`)
    assert.equal(takes.filter((take) => take.language === 'ja').length, 3, `${voice.id} 日文样音应为 3 条`)
    assert.ok(takes.every((take) => take.speaker === voice.speaker))
    assert.ok(takes.every((take) => take.text.trim() && take.text.length >= 2))
    assert.ok(new Set(takes.map((take) => take.text)).size === takes.length, `${voice.id} 台词不应重复`)
  }
  for (const take of manifest.takes) {
    assert.match(take.outputFile, /^generated\/[a-z0-9-]+\.wav$/)
    const bytes = readFileSync(new URL(take.outputFile, pack))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), take.sha256)
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF')
    assert.ok(take.durationSeconds > 0.5 && take.durationSeconds < 45)
    assert.ok(take.sampleRate >= 8000)
    assert.ok(take.instruction.trim())
    assert.ok(take.scene.trim() && take.emotion.trim())
  }
})

test('workspace exposes dialogue voice seed command and runtime test wiring', () => {
  const rootPkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(rootPkg.scripts['voice:dialogue:seed'], 'pnpm --filter dreamchord-server exec tsx prisma/seedDialogueVoices.ts')
  assert.match(rootPkg.scripts['test:voice-runtime'], /dialogue-pack-manifest\.test\.mjs/)
})
