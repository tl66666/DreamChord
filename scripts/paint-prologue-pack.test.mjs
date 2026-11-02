import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from '../apps/server/node_modules/sharp/lib/index.js'
import { PAINT_PROLOGUE, PAINT_STARTER_CARD } from '../packages/story-domain/dist/index.js'
const root = new URL('../', import.meta.url)
const read = name => readFileSync(new URL(name, root))
const json = name => JSON.parse(read(name).toString('utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('all 59 final Japanese recordings match the authored script and runtime bytes', () => {
  const m = json('assets/voice-packs/paint-prologue/manifest.json')
  assert.equal(m.dialogueEngine, 'GPT-SoVITS')
  assert.equal(m.trainedCharacterWeights, false)
  assert.equal(m.humanListeningCompleted, false)
  const lines = [...PAINT_PROLOGUE.graph.nodes, PAINT_STARTER_CARD].filter(n => n.type === 'dialogue')
  assert.equal(lines.length, 59)
  for (const line of lines) {
    const take = m.takes.find(t => t.id === `${line.id}-ja`)
    assert.ok(take, line.id)
    assert.equal(take.text, line.data.localizations.ja.text)
    assert.equal(hash(read(`assets/voice-packs/paint-prologue/${take.outputFile}`)), take.sha256)
    assert.equal(hash(read(`apps/web/public${take.runtimeFile}`)), take.runtimeSha256)
  }
  for (const ref of m.references) assert.equal(hash(read(`assets/voice-packs/paint-prologue/${ref.outputFile}`)), ref.sha256)
})

test('all scene originals and runtime backgrounds have provenance and no cropped framing', async () => {
  const m = json('source-assets/paint-prologue/background-manifest.json')
  assert.equal(m.assets.length, 6)
  for (const a of m.assets) {
    assert.ok(a.prompt && a.nativePath)
    assert.equal(hash(read(`source-assets/paint-prologue/${a.id}.png`)), a.sourceSha256)
    const bytes = read(`apps/web/public${a.runtimeFile}`)
    assert.equal(hash(bytes), a.runtimeSha256)
    const size = await sharp(bytes).metadata()
    assert.equal(size.width, 1920); assert.equal(size.height, 1080)
  }
  assert.equal(hash(read('apps/web/public/assets/paint-prologue/cover.webp')), hash(read('apps/web/public/assets/paint-prologue/workshop.webp')))
})

test('all cast expression assets are large full-body sprites with real transparent margins', async () => {
  for (const c of PAINT_PROLOGUE.characters) for (const expr of c.slug === 'lu' ? ['normal'] : ['normal', 'smile', 'serious']) {
    const bytes = read(`apps/web/public/assets/paint-prologue/${c.slug}-${expr}.png`)
    const meta = await sharp(bytes).metadata()
    assert.equal(meta.width, 1024); assert.equal(meta.height, 1536); assert.equal(meta.hasAlpha, true)
    const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true })
    const occupied = []
    for (let y = 0; y < info.height; y++) if (data.subarray(y * info.width * 4, (y + 1) * info.width * 4).some((v, i) => i % 4 === 3 && v > 128)) occupied.push(y)
    assert.ok(occupied[0] >= 60 && occupied[0] <= 85, `${c.slug} top margin`)
    assert.ok(occupied.length / info.height > .89, `${c.slug} full-body scale`)
    assert.equal(data[3], 0)
  }
})

test('every runtime file referenced by the graph, cover and starter is present', () => {
  const scan = value => typeof value === 'string' ? (value.startsWith('/assets/') ? [value] : []) : Array.isArray(value) ? value.flatMap(scan) : value && typeof value === 'object' ? Object.values(value).flatMap(scan) : []
  for (const url of new Set(scan([PAINT_PROLOGUE, PAINT_STARTER_CARD]))) assert.ok(read(`apps/web/public${url}`).length > 100, url)
})
