import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const root = fileURLToPath(new URL('..', import.meta.url))
const page = resolve(root, 'docs/showcase.html')
const html = readFileSync(page, 'utf8')
let assets = 0
for (const match of html.matchAll(/(?:src|data-zoom|poster)="([^"]+)"/g)) {
  if (/^(?:https?:|data:)/.test(match[1])) continue
  assert.ok(existsSync(resolve(dirname(page), match[1])), `Missing showcase resource: ${match[1]}`)
  assets++
}
for (const [file, digest] of [
  ['yuki-zh.wav', '10bae76609e49839c9a7207a2aedd468327029764ff2706048a70cdbaf56004e'],
  ['yuki-ja.wav', 'd4fbf5fe98b6e0f06cb4acda42f4479c35b1968251f8b4df96ded0d7773e9fde'],
]) {
  assert.equal(createHash('sha256').update(readFileSync(resolve(root, 'docs/assets/audio', file))).digest('hex'), digest, `Audio provenance changed: ${file}`)
}
for (const keyword of ['自动配音', '暂停', '日语', '合成样音', '公开播放器']) assert.ok(html.includes(keyword), `Missing product boundary: ${keyword}`)
console.log(`Presentation verified: ${assets} resource references, both licensed audio hashes, voice workflow and boundaries.`)
