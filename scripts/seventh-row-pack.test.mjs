import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { SEVENTH_ROW_DEMO } from '../packages/story-domain/dist/index.js'
const root = resolve(import.meta.dirname, '..')
const read = file => readFileSync(resolve(root, file))
const json = file => JSON.parse(read(file).toString('utf8'))
const sha = file => createHash('sha256').update(read(file)).digest('hex')
const pack = 'assets/voice-packs/seventh-row'
const manifest = json(`${pack}/manifest.json`)
test('all original story branches ship exact-script Chinese and Japanese recordings', () => {
  const lines = SEVENTH_ROW_DEMO.graph.nodes.filter(n => n.type === 'dialogue' && n.data.role !== '旁白')
  assert.equal(manifest.takes.length, lines.length * 2)
  assert.equal(new Set(manifest.takes.map(t => t.id)).size, lines.length * 2)
  assert.equal(manifest.syntheticSource, true)
  assert.equal(manifest.sourceLicense, 'Apache-2.0')
  for (const node of lines) for (const language of ['zh', 'ja']) {
    const take = manifest.takes.find(t => t.id === `${node.id}-${language}`)
    assert.equal(take?.text, language === 'zh' ? node.data.text : node.data.localizations.ja.text)
    assert.equal(sha(`${pack}/${take.outputFile}`), take.sha256)
    assert.equal(sha(`apps/web/public${take.runtimeFile}`), take.runtimeSha256)
    assert.ok(take.durationSeconds > .4 && take.durationSeconds < 33)
  }
  for (const voice of manifest.voices) for (const language of ['zh', 'ja']) assert.ok(manifest.takes.some(t => t.role === voice.id && t.language === language && t.durationSeconds >= 3.5 && t.durationSeconds <= 9.5), 'Clone reference has a usable duration')
})
test('cinema sprites fill the standard transparent canvas and backgrounds share a wide composition', async () => {
  const sharp = createRequire(new URL('../apps/server/package.json', import.meta.url))('sharp')
  for (const role of ['luyao', 'chengxia', 'chenyu']) for (const expression of ['normal', 'sad', 'smile']) {
    const file = resolve(root, `apps/web/public/assets/seventh-row/${role}-${expression}.png`)
    const metadata = await sharp(file).metadata()
    assert.deepEqual([metadata.width, metadata.height, metadata.hasAlpha], [1024, 1536, true])
    const top = await sharp(file).extract({ left: 0, top: 0, width: 1024, height: 200 }).stats()
    assert.ok(top.channels[3].max > 220, 'Head must not hide beneath hundreds of blank pixels')
  }
  for (const name of ['cinema-rain', 'projection-room', 'auditorium']) {
    const metadata = await sharp(resolve(root, `apps/web/public/assets/seventh-row/${name}.webp`)).metadata()
    assert.deepEqual([metadata.width, metadata.height], [1920, 1080])
  }
})
test('the five scene cues retain human-composed CC0 soundtrack provenance', () => {
  const tracks = json('apps/web/public/assets/audio/seventh-row/music-credits.json')
  const sources = json('assets/music-packs/ternox-vn/manifest.json').tracks
  assert.equal(tracks.length, 5)
  for (const track of tracks) {
    assert.equal(track.license, 'CC0-1.0')
    assert.equal(track.sha256, sources.find(s => s.role === track.sourceRole).sha256)
    assert.equal(track.sha256, sha(`apps/web/public/assets/audio/seventh-row/${track.id}.ogg`))
  }
})
