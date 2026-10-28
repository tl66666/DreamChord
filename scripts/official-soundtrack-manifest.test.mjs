import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'assets', 'music-packs', 'ternox-vn', 'manifest.json')

test('official soundtrack is human-composed, CC0, hashed, and role-complete', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assert.equal(manifest.packId, 'ternox-vn-official')
  assert.equal(manifest.sourceLicense, 'CC0-1.0')
  assert.equal(manifest.generativeAiUsed, false)
  assert.equal(manifest.author, 'TERNOX')
  assert.equal(manifest.archiveSha256.length, 64)
  assert.deepEqual(new Set(manifest.tracks.map((track) => track.role)), new Set([
    'twilight',
    'erasure',
    'ren',
    'miya',
    'sora',
    'finale',
    'failure',
    'coauthor',
    'agency',
    'afternoon',
    'daily',
    'name',
    'mischief',
  ]))
  assert.equal(new Set(manifest.tracks.map((track) => track.id)).size, manifest.tracks.length)
  for (const track of manifest.tracks) {
    assert.match(track.sha256, /^[a-f0-9]{64}$/)
    assert.match(track.outputFile, /^runtime\/[a-z0-9-]+\.ogg$/)
    assert.ok(track.originalFile)
    assert.ok(track.mood)
    assert.ok(track.scenes.length > 0)
    assert.ok(track.durationSeconds > 10)
    assert.equal(track.author, 'TERNOX')
    assert.equal(track.license, 'CC0-1.0')
    assert.equal(track.sourceUrl, 'https://ternox.itch.io/vn-music')
    const runtimeFile = path.join(root, 'assets', 'music-packs', 'ternox-vn', ...track.outputFile.split('/'))
    const publicFile = path.join(root, 'apps', 'web', 'public', 'assets', 'audio', 'demo', path.basename(track.outputFile))
    const runtimeHash = createHash('sha256').update(readFileSync(runtimeFile)).digest('hex')
    const publicHash = createHash('sha256').update(readFileSync(publicFile)).digest('hex')
    assert.equal(runtimeHash, track.sha256, `${track.name} runtime hash`)
    assert.equal(publicHash, track.sha256, `${track.name} public hash`)
  }
})

test('workspace exposes official soundtrack install and validation commands', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.match(pkg.scripts['music:official:install'], /install-official-soundtrack/)
  assert.match(pkg.scripts['test:voice-runtime'], /official-soundtrack-manifest/)
})
