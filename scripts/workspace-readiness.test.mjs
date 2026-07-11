import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const pretest = manifest.scripts?.pretest ?? ''
const preparation = manifest.scripts?.['prepare:workspace'] ?? ''
const testSetup = `${pretest} ${pretest.includes('prepare:workspace') ? preparation : ''}`

assert.match(testSetup, /@dreamchord\/story-domain[^&]*build/, 'pretest must build the shared story domain')
assert.match(testSetup, /dreamchord-server[^&]*prisma generate/, 'pretest must generate Prisma Client')

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
assert.match(workflow, /node-version:\s*20/, 'CI must use Node.js 20')
assert.match(workflow, /version:\s*9\.1\.0/, 'CI must pin pnpm 9.1.0')
for (const command of ['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm test', 'pnpm build']) {
  assert.ok(workflow.includes(command), `CI must run ${command}`)
}

const launcher = readFileSync(new URL('../start-dreamchord.ps1', import.meta.url), 'utf8')
assert.doesNotMatch(launcher, /Stop-Process/, 'launcher must not terminate unrelated port owners')
assert.match(launcher, /versionNum\s+-lt\s+20/, 'launcher must require Node.js 20')
assert.match(launcher, /corepack/, 'launcher must bootstrap the pinned package manager')
assert.match(launcher, /pnpm install --frozen-lockfile/, 'launcher must install from the workspace lockfile')
assert.match(launcher, /prisma migrate deploy/, 'launcher must deploy committed migrations')

const doctor = readFileSync(new URL('./doctor.ps1', import.meta.url), 'utf8')
assert.match(doctor, /\[PASS\]/, 'doctor must emit machine-readable pass results')
assert.match(doctor, /\[FAIL\]/, 'doctor must emit machine-readable failure results')

console.log('workspace readiness scripts are configured')
