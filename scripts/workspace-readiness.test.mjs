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

console.log('workspace readiness scripts are configured')
