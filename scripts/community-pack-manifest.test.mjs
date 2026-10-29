import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'assets', 'music-packs', 'community-vn', 'manifest.json')
const voiceManifestPath = path.join(root, 'assets', 'voice-packs', 'dreamchord-human', 'manifest.json')

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

const expectedBgmRoles = [
  'amacha-yuruyakana', 'amacha-heian', 'amacha-yume', 'amacha-natsunokiri', 'amacha-yomichi', 'amacha-tanken',
  'tam-koto', 'tam-eika', 'tam-ame', 'tam-harari', 'tam-atelier',
  'maou-chouchin', 'maou-akikaze', 'maou-shukumei', 'maou-milkyway', 'maou-healing15', 'maou-fantasy15', 'maou-piano12', 'maou-acoustic29',
  'ds-chaolu', 'ds-denghuo', 'ds-sicai', 'ds-baihu',
]

const expectedSfxRoles = [
  'sfx-heartbeat', 'sfx-explosion', 'sfx-footsteps', 'sfx-rain', 'sfx-wind', 'sfx-alarm', 'sfx-doorbell', 'sfx-page-flip',
]

test('community pack is human-composed, multi-source, hashed, and role-complete', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.packId, 'dreamchord-community-vn')
  assert.equal(manifest.generativeAiUsed, false)
  assert.deepEqual(manifest.tracks.map((track) => track.role), expectedBgmRoles)
  assert.deepEqual(manifest.sfx.map((entry) => entry.role), expectedSfxRoles)
  assert.equal(new Set(manifest.tracks.map((track) => track.id)).size, manifest.tracks.length)

  for (const track of manifest.tracks) {
    assert.match(track.sha256, /^[a-f0-9]{64}$/)
    assert.match(track.outputFile, /^runtime\/[a-z0-9-]+\.ogg$/)
    assert.match(track.originalSha256, /^[a-f0-9]{64}$/)
    assert.ok(track.originalFile)
    assert.ok(track.mood)
    assert.ok(track.scenes.length > 0)
    assert.ok(track.durationSeconds > 20, `${track.name} should be a long BGM track`)
    assert.ok(track.author)
    assert.ok(track.license)
    assert.ok(track.sourceUrl.startsWith('http'))
    const runtimeFile = path.join(root, 'assets', 'music-packs', 'community-vn', ...track.outputFile.split('/'))
    assert.equal(sha256(runtimeFile), track.sha256, `${track.name} runtime hash`)
  }

  for (const entry of manifest.sfx) {
    assert.match(entry.sha256, /^[a-f0-9]{64}$/)
    assert.match(entry.outputFile, /^runtime\/sfx\/[a-z0-9-]+\.ogg$/)
    assert.ok(entry.mood)
    assert.ok(entry.scenes.length > 0)
    assert.ok(entry.durationSeconds > 1)
    assert.equal(entry.author, 'OtoLogic')
    assert.equal(entry.license, 'CC BY 4.0（署名『OtoLogic』）· OtoLogic')
    const runtimeFile = path.join(root, 'assets', 'music-packs', 'community-vn', ...entry.outputFile.split('/'))
    assert.equal(sha256(runtimeFile), entry.sha256, `${entry.name} sfx hash`)
  }
})

test('community pack keeps required source attributions', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const tamTracks = manifest.tracks.filter((track) => track.role.startsWith('tam-'))
  for (const track of tamTracks) {
    assert.ok(track.license.includes('TAM Music Factory'), 'TAM tracks must keep attribution')
    assert.equal(track.sourceUrl, 'https://www.tam-music.com/')
  }
  const dsTracks = manifest.tracks.filter((track) => track.role.startsWith('ds-'))
  for (const track of dsTracks) {
    assert.ok(track.license.includes('龍的交響楽'), '龍的交響楽 tracks must keep the required mark')
  }
  const amachaTracks = manifest.tracks.filter((track) => track.role.startsWith('amacha-'))
  assert.equal(amachaTracks.length, 6)
  for (const track of amachaTracks) {
    assert.ok(track.license.includes('甘茶'))
  }
})

test('official demo sfx files exist and match the community manifest', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const files = manifest.demoSfx.files
  assert.deepEqual(files.map((file) => file.role), ['sfx-erase', 'sfx-paper', 'sfx-node', 'sfx-clock', 'sfx-save'])
  for (const file of files) {
    assert.match(file.outputFile, /^apps\/web\/public\/assets\/audio\/demo\/sfx-[a-z-]+\.ogg$/)
    const target = path.join(root, ...file.outputFile.split('/'))
    assert.ok(readFileSync(target), `${file.role} must exist`)
    assert.equal(sha256(target), file.sha256, `${file.role} hash`)
    assert.ok(file.sourceUrl.includes('otologic.jp'))
  }
})

test('human voice pack is real-human CC BY, hashed, and profile-complete', () => {
  const manifest = JSON.parse(readFileSync(voiceManifestPath, 'utf8'))
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.packId, 'dreamchord-human')
  assert.equal(manifest.generativeAiUsed, false)
  assert.equal(manifest.syntheticSource, false)
  assert.equal(manifest.source.site, 'OtoLogic')
  assert.equal(manifest.source.license, 'CC BY 4.0')
  assert.equal(manifest.source.redistributionAllowed, true)
  assert.equal(manifest.profiles.length, 3)
  const clipRoles = manifest.profiles.flatMap((profile) => profile.clips.map((clip) => clip.role))
  assert.equal(clipRoles.length, 13)
  assert.equal(new Set(clipRoles).size, clipRoles.length)
  for (const profile of manifest.profiles) {
    assert.ok(profile.clips.some((clip) => clip.role === profile.previewClip), `${profile.name} previewClip`)
    assert.ok(profile.language === 'ja-JP' || profile.language === 'zh-CN')
    assert.ok(profile.usageNote || manifest.usageNote)
  }
  for (const profile of manifest.profiles) {
    for (const clip of profile.clips) {
      assert.match(clip.sha256, /^[a-f0-9]{64}$/)
      assert.match(clip.outputFile, /^runtime\/[a-z0-9-]+\.ogg$/)
      assert.ok(clip.durationSeconds >= 1 && clip.durationSeconds <= 30)
      const runtimeFile = path.join(root, 'assets', 'voice-packs', 'dreamchord-human', ...clip.outputFile.split('/'))
      assert.equal(sha256(runtimeFile), clip.sha256, `${clip.role} hash`)
    }
  }
})

test('workspace exposes human voice seed command and manifest validation', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.match(pkg.scripts['voice:human:seed'], /seedHumanVoices/)
  assert.match(pkg.scripts['test:voice-runtime'], /community-pack-manifest/)
})
