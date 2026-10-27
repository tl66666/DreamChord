import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  MINIFORGE_RELEASE,
  chooseRuntimeRoot,
  parseSha256,
  upsertEnvText,
} from './voice-runtime-config.mjs'

test('chooses the roomiest fixed drive with at least 40 GiB', () => {
  assert.equal(chooseRuntimeRoot([
    { root: 'C:\\', freeGiB: 30 },
    { root: 'D:\\', freeGiB: 136 },
    { root: 'E:\\', freeGiB: 99 },
  ]), 'D:\\DreamChordRuntime')
})

test('fails before installation when no drive has enough room', () => {
  assert.throws(() => chooseRuntimeRoot([{ root: 'C:\\', freeGiB: 12 }]), /40GB/)
})

test('parses the official versioned Miniforge checksum', () => {
  const sha = 'a'.repeat(64)
  assert.equal(parseSha256(`${sha}  Miniforge3-26.9.4-0-Windows-x86_64.exe`), sha)
  assert.throws(() => parseSha256('not-a-checksum'), /SHA256/)
})

test('updates one env key without discarding comments', () => {
  assert.equal(
    upsertEnvText('# local\nPORT=3001\n', 'GPT_SOVITS_HOME', 'D:\\DreamChordRuntime\\gpt-sovits'),
    '# local\nPORT=3001\nGPT_SOVITS_HOME="D:/DreamChordRuntime/gpt-sovits"\n',
  )
})

test('replaces an existing env key without duplicating it', () => {
  const result = upsertEnvText('GPT_SOVITS_HOME="C:/old"\nPORT=3001\n', 'GPT_SOVITS_HOME', 'D:/new')
  assert.equal(result, 'GPT_SOVITS_HOME="D:/new"\nPORT=3001\n')
})

test('pins a versioned Miniforge installer and checksum', () => {
  assert.equal(MINIFORGE_RELEASE.tag, '25.9.1-0')
  assert.match(MINIFORGE_RELEASE.installer, /Miniforge3-\d+\.\d+\.\d+-\d+-Windows-x86_64\.exe$/)
  assert.equal(MINIFORGE_RELEASE.checksum, `${MINIFORGE_RELEASE.installer}.sha256`)
  assert.match(MINIFORGE_RELEASE.baseUrl, /^https:\/\/github\.com\/conda-forge\/miniforge\/releases\/download\//)
})

test('uses PowerShell 7 so UTF-8 installer messages parse correctly on Windows', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.match(packageJson.scripts['voice:setup'], /^pwsh /)
  assert.match(packageJson.scripts['voice:setup:cpu'], /^pwsh /)
})

test('installer does not mistake the pretrained .gitignore placeholder for a complete runtime', () => {
  const installer = fs.readFileSync(new URL('./setup-gpt-sovits.ps1', import.meta.url), 'utf8')
  assert.match(installer, /pretrained_models\\sv/)
  assert.match(installer, /Import-Module-Check.*torch/s)
  for (const moduleName of ['numpy', 'soundfile', 'fastapi', 'resampy']) {
    assert.match(installer, new RegExp(`Import-Module-Check \\$environmentPython '${moduleName}'`))
  }
})

test('starter voice generation resolves the managed Python instead of hard-coding a drive', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.scripts['voice:starter:generate'], 'pwsh -NoProfile -File scripts/generate-starter-voices.ps1')
})

test('installer uses an ASCII temporary directory for native Python builds', () => {
  const installer = fs.readFileSync(new URL('./setup-gpt-sovits.ps1', import.meta.url), 'utf8')
  assert.match(installer, /Join-Path \$RuntimeRoot 'tmp'/)
  assert.match(installer, /\$env:TEMP = \$nativeBuildTemp/)
  assert.match(installer, /\$env:TMP = \$nativeBuildTemp/)
})
