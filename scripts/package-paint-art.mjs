import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import sharp from '../apps/server/node_modules/sharp/lib/index.js'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'source-assets/paint-prologue')
const target = path.join(root, 'apps/web/public/assets/paint-prologue')
await mkdir(target, { recursive: true })
const manifestPath = path.join(source, 'background-manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
for (const item of manifest.assets) {
  const original = path.join(source, `${item.id}.png`)
  if (process.argv.includes('--ingest')) await copyFile(item.nativePath, original)
  const raw = await readFile(original)
  await sharp(raw).resize(1920, 1080, { fit: 'fill' }).webp({ quality: 91 }).toFile(path.join(target, `${item.id}.webp`))
  item.sourceSha256 = createHash('sha256').update(raw).digest('hex')
  item.runtimeFile = `/assets/paint-prologue/${item.id}.webp`
  item.runtimeSha256 = createHash('sha256').update(await readFile(path.join(target, `${item.id}.webp`))).digest('hex')
}
// The story cover shares its opening location, without giving away the outside perspective.
await copyFile(path.join(target, 'workshop.webp'), path.join(target, 'cover.webp'))
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`${manifest.assets.length} backgrounds + opening cover packaged; originals retained.`)
