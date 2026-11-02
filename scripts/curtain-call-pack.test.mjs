import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from '../apps/server/node_modules/sharp/lib/index.js'
import { CURTAIN_CALL_DEMO, CURTAIN_STARTER_ENDING } from '../packages/story-domain/dist/index.js'
const root = new URL('../', import.meta.url)
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
test('every bilingual spoken line and the editable starter have verified runtime audio', () => {
  const manifest = JSON.parse(readFileSync(new URL('assets/voice-packs/curtain-call/manifest.json', root), 'utf8'))
  assert.equal(manifest.dialogueEngine, 'GPT-SoVITS')
  for (const n of [...CURTAIN_CALL_DEMO.graph.nodes.filter(n => n.type === 'dialogue'), CURTAIN_STARTER_ENDING]) for (const language of ['zh', 'ja']) {
    const take = manifest.takes.find(t => t.id === `${n.id}-${language}`)
    assert.ok(take, `${n.id}-${language}`)
    assert.equal(take.text, language === 'zh' ? n.data.text : n.data.localizations.ja.text)
    assert.equal(digest(readFileSync(new URL(`assets/voice-packs/curtain-call/${take.outputFile}`, root))), take.sha256)
    assert.equal(digest(readFileSync(new URL(`apps/web/public${take.runtimeFile}`, root))), take.runtimeSha256)
  }
})
test('full-height alpha sprites support both portrait editing and a half-body stage', async () => {
  for (const c of CURTAIN_CALL_DEMO.characters) for (const expression of ['normal', 'sad', 'smile']) {
    const image = sharp(readFileSync(new URL(`apps/web/public/assets/curtain-call/${c.slug}-${expression}.png`, root)))
    const info = await image.metadata()
    assert.equal(info.width, 1024); assert.equal(info.height, 1536); assert.ok(info.hasAlpha)
    const { data, info: raw } = await image.raw().toBuffer({ resolveWithObject: true })
    let first = raw.height
    for (let y = 0; y < raw.height; y++) { if (data.subarray(y * raw.width * 4, (y + 1) * raw.width * 4).some((v, i) => i % 4 === 3 && v > 80)) { first = y; break } }
    assert.ok(first < 80, `${c.slug}-${expression} begins too low: ${first}`)
  }
})
test('human-composed music carries attribution and a verified digest', () => {
  const credits = JSON.parse(readFileSync(new URL('apps/web/public/assets/audio/curtain-call/music-credits.json', root), 'utf8'))
  assert.equal(credits.length, 4)
  for (const t of credits) { assert.equal(t.author, 'TERNOX'); assert.equal(t.license, 'CC0-1.0'); assert.equal(digest(readFileSync(new URL(`apps/web/public/assets/audio/curtain-call/${t.id}.ogg`, root))), t.sha256) }
})
