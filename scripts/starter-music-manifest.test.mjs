import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('DreamChord starter music pack contains three original traceable story cues', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, 'assets/music-packs/dreamchord-starter/manifest.json'), 'utf8'))
  assert.equal(manifest.packId, 'dreamchord-music-starter')
  assert.equal(manifest.sourceLicense, 'MIT')
  assert.match(manifest.source, /procedural/i)
  assert.equal(manifest.tracks.length, 3)
  assert.equal(new Set(manifest.tracks.map((track) => track.id)).size, 3)
  for (const track of manifest.tracks) {
    assert.equal(track.loop, true)
    assert.match(track.outputFile, /^generated\/.+\.wav$/)
    assert.ok(track.mood && track.style && track.scene)
    assert.equal(track.sampleRate, 24000)
    if (track.sha256 !== null) assert.match(track.sha256, /^[a-f0-9]{64}$/)
  }
})

test('workspace exposes repeatable starter music generation and seeding commands', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.match(pkg.scripts['music:starter:generate'], /generate-starter-music/)
  assert.match(pkg.scripts['music:seed'], /seedStarterMusic/)
})
