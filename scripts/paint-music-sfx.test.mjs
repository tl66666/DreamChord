import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const runtime = resolve(root, 'apps/web/public/assets/audio/paint-prologue')
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
for (const [kind, ids, author, license] of [
  ['music', ['afterglow', 'workshop'], 'TERNOX', 'CC0-1.0'],
  ['sfx', ['applause', 'paper', 'wood'], 'OtoLogic', 'CC-BY-4.0'],
]) test(`paint ${kind} has complete credited, decodable and hash-checked runtime media`, () => {
  const credits = JSON.parse(readFileSync(resolve(runtime, `${kind}-credits.json`), 'utf8'))
  assert.deepEqual(credits.map(c => c.id).sort(), ids)
  for (const credit of credits) {
    assert.equal(credit.author, author)
    assert.equal(credit.license, license)
    assert.match(credit.sourceUrl, /^https:\/\//)
    assert.match(credit.licenseUrl, /^https:\/\//)
    assert.equal(credit.runtimeFile, `/assets/audio/paint-prologue/${credit.id}.ogg`)
    assert.ok(credit.name && credit.processing && credit.sourceFile)
    assert.equal(credit.generativeAiUsed, false)
    assert.ok(existsSync(resolve(root, credit.sourceFile)))
    assert.equal(hash(resolve(root, credit.sourceFile)), credit.sourceSha256)
    const file = resolve(root, `apps/web/public${credit.runtimeFile}`)
    assert.equal(hash(file), credit.runtimeSha256)
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', file], { encoding: 'utf8' }))
    assert.equal(probe.streams[0].codec_name, 'vorbis')
    assert.ok(Math.abs(Number(probe.format.duration) - credit.durationSeconds) < .03)
    assert.ok(credit.durationSeconds > .1 && credit.durationSeconds < (kind === 'music' ? 300 : 10))
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'null', '-'], { stdio: 'pipe' })
  }
})
