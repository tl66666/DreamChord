import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const directory = resolve(root, 'apps/web/public/assets/audio/paint-book')
const expected = {
  'tam-atelier': 'tam-atelier.ogg',
  'tam-ame': 'tam-ame.ogg',
  'maou-acoustic29': 'maoudamashii-acoustic29.ogg',
  'maou-piano12': 'maoudamashii-piano12.ogg',
  'maou-healing15': 'maoudamashii-healing15.ogg',
  'ds-chaolu': 'dragonic-symphony-chaolu.ogg',
  'amacha-tanken': 'amacha-tanken.ogg',
  'amacha-yume': 'amacha-yume.ogg',
}
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const creditsFile = resolve(directory, 'music-credits.json')
const loadCredits = () => JSON.parse(readFileSync(creditsFile, 'utf8'))

test('paint book ships exactly eight existing author-composed tracks as credited story BGM', () => {
  assert.ok(existsSync(creditsFile), 'the eight-track story credits must exist')
  const credits = loadCredits()
  const source = JSON.parse(readFileSync(resolve(root, 'assets/music-packs/community-vn/manifest.json'), 'utf8'))
  assert.deepEqual(credits.map(c => c.id).sort(), Object.keys(expected).sort())
  assert.equal(new Set(credits.map(c => c.runtimeSha256)).size, 8)
  for (const credit of credits) {
    const original = source.tracks.find(t => t.role === credit.id)
    assert.ok(original, `${credit.id} must already exist in the local source pack`)
    assert.equal(credit.runtimeFile, `/assets/audio/paint-book/${expected[credit.id]}`)
    assert.equal(credit.sourceFile, `assets/music-packs/community-vn/${original.outputFile}`)
    assert.equal(credit.sourceSha256, original.sha256)
    assert.equal(credit.runtimeSha256, original.sha256, 'runtime must preserve original bytes')
    assert.equal(sha256(resolve(root, credit.sourceFile)), credit.sourceSha256)
    assert.equal(sha256(resolve(root, `apps/web/public${credit.runtimeFile}`)), credit.runtimeSha256)
    assert.equal(credit.originalFile, original.originalFile)
    assert.equal(credit.originalSha256, original.originalSha256)
    assert.ok(credit.name && credit.author && credit.license && credit.creditLine)
    assert.match(credit.sourceUrl, /^https:\/\//)
    assert.match(credit.licenseUrl, /^https:\/\//)
    assert.equal(credit.generativeAiUsed, false)
    assert.equal(credit.humanListeningCompleted, false)
    assert.equal(credit.seamlessLoopVerified, false)
    assert.match(credit.usageScope, /游戏.*BGM/)
    assert.match(credit.usageScope, /不.*独立.*素材/)
    assert.match(credit.processing, /原样复制/)
    assert.equal(credit.processingOriginalPack, 'assets/music-packs/community-vn/manifest.json')
  }
})

test('all eight runtime files fully decode as stereo 44.1kHz Vorbis with credited durations', () => {
  assert.ok(existsSync(creditsFile), 'runtime credits must exist before audio validation')
  for (const credit of loadCredits()) {
    const file = resolve(root, `apps/web/public${credit.runtimeFile}`)
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', file], { encoding: 'utf8' }))
    assert.equal(probe.streams[0].codec_name, 'vorbis')
    assert.equal(probe.streams[0].sample_rate, '44100')
    assert.equal(probe.streams[0].channels, 2)
    assert.ok(Math.abs(Number(probe.format.duration) - credit.durationSeconds) < .01)
    assert.ok(credit.durationSeconds > 60 && credit.durationSeconds < 300)
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'null', '-'], { stdio: 'pipe' })
  }
})

test('source rules, composer credits and portable audition paths remain explicit', () => {
  assert.ok(existsSync(creditsFile), 'credits must exist before source validation')
  for (const credit of loadCredits()) {
    if (credit.id.startsWith('maou-')) {
      assert.equal(credit.license, 'CC-BY-4.0')
      assert.equal(credit.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/')
      assert.equal(credit.author, '森田交一（魔王魂）')
      assert.match(credit.creditLine, /音楽：魔王魂/)
      assert.match(credit.creditLine, /森田交一/)
      assert.equal(credit.sourceTermsUrl, 'https://maou.audio/rule/')
      assert.match(credit.licenseBasis, /CC BY 4\.0/)
      assert.doesNotMatch(credit.licenseBasis, /署名任意/)
    }
    if (credit.id.startsWith('tam-')) assert.match(credit.creditLine, /音楽：TAM Music Factory/)
    if (credit.id.startsWith('ds-')) assert.match(credit.creditLine, /龍的交響楽/)
    if (credit.id.startsWith('amacha-')) assert.match(credit.creditLine, /甘茶の音楽工房/)
  }
  const html = readFileSync(resolve(root, 'docs/paint-book-music-audition.html'), 'utf8')
  const mapping = JSON.parse(readFileSync(resolve(root, 'assets/story-packs/paint-book/music-map.json'), 'utf8'))
  assert.equal(mapping.usage, 'story-bgm-only')
  assert.deepEqual(mapping.tracks.map(t => t.id).sort(), Object.keys(expected).sort())
  for (const [id, file] of Object.entries(expected)) {
    assert.equal(mapping.tracks.find(t => t.id === id).url, `/assets/audio/paint-book/${file}`)
    assert.equal(mapping.tracks.find(t => t.id === id).creditsPage, '/assets/audio/paint-book/credits.html')
    assert.ok(html.includes(loadCredits().find(c => c.id === id).sourceUrl))
    assert.ok(!html.includes(`../apps/web/public/assets/audio/paint-book/${file}`))
  }
  assert.doesNotMatch(html, /<(?:audio|source)\b|href=["'][^"']+\.(?:ogg|mp3)|src=["'][^"']+\.(?:ogg|mp3)/i)
  assert.doesNotMatch(html, /https?:\/\/[^"\s]+\.(?:ogg|mp3)/)
  assert.match(html, /未完成人耳试听/)
})

test('public music credits are human-readable attribution with no standalone audio distribution', () => {
  const file = resolve(directory, 'credits.html')
  assert.ok(existsSync(file), 'game end page needs a public human-readable credits page')
  const html = readFileSync(file, 'utf8')
  assert.match(html, /<html lang="zh-CN"/)
  assert.match(html, /请让这幅画老去/)
  assert.doesNotMatch(html, /<(?:audio|source)\b|href=["'][^"']+\.(?:ogg|mp3)|src=["'][^"']+\.(?:ogg|mp3)/i)
  for (const credit of loadCredits()) {
    assert.ok(html.includes(credit.originalName), `${credit.id} original title readable`)
    assert.ok(html.includes(credit.author), `${credit.id} author readable`)
    assert.ok(html.includes(credit.sourceUrl), `${credit.id} author source linked`)
    assert.ok(html.includes(credit.licenseUrl), `${credit.id} license linked`)
    assert.ok(html.includes(credit.scene), `${credit.id} intended use readable`)
    assert.equal(credit.creditsPage, '/assets/audio/paint-book/credits.html')
  }
  assert.match(html, /原样复制/)
  assert.match(html, /未重编码/)
})

test('legacy community notes do not waive Maou attribution or grant standalone music-library redistribution', () => {
  const source = JSON.parse(readFileSync(resolve(root, 'assets/music-packs/community-vn/manifest.json'), 'utf8'))
  for (const track of source.tracks.filter(t => t.role.startsWith('maou-'))) {
    assert.doesNotMatch(track.license, /署名任意/)
    assert.match(track.license, /须署名/)
  }
  const notes = readFileSync(resolve(root, 'assets/music-packs/community-vn/LICENSE-SOURCE.md'), 'utf8')
  assert.doesNotMatch(notes, /可自托管分发|署名任意|仅作为 DreamChord 应用内置曲库随应用分发/)
  assert.match(notes, /不.*独立.*素材库/)
})
