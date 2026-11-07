import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from '../apps/server/node_modules/sharp/lib/index.js'
const root = new URL('../', import.meta.url), source = 'source-assets/paint-chapter-three/', runtime = 'apps/web/public/assets/paint-chapter-three/'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(new URL(source, root), { recursive: true })
await mkdir(new URL(runtime, root), { recursive: true })
const manifestURL = new URL(source + 'art-manifest.json', root)
let manifest
if (process.argv.includes('--ingest')) {
  const input = JSON.parse(await readFile(new URL('.runtime/paint-chapter-three-art-input.json', root), 'utf8'))
  manifest = { title: '请让这幅画老去', chapterTitle: '第三章 · 画外的夏天', createdAt: '2026-11-07', generator: 'built-in image_gen.imagegen', assets: [] }
  for (const item of input) {
    if (!['summer-atelier', 'seaside-afternoon', 'archive-window'].includes(item.id)) throw Error('Unexpected asset ID')
    const nativeFile = `${source}${item.id}-native.png`, sourceFile = `${source}${item.id}.png`, publicFile = `${runtime}${item.id}.webp`
    await copyFile(item.generationSourcePath, new URL(nativeFile, root))
    const bytes = await readFile(new URL(nativeFile, root)), meta = await sharp(bytes).metadata()
    if (meta.format !== 'png' || !meta.width || !meta.height) throw Error('Native image is invalid')
    await sharp(bytes).resize(1920, 1080, { fit: 'fill' }).png().toFile(fileURLToPath(new URL(sourceFile, root)))
    manifest.assets.push({ id: item.id, prompt: item.prompt, generationSourcePath: item.generationSourcePath, generator: manifest.generator, nativeFile, sourceFile, publicFile, publicUrl: `/assets/paint-chapter-three/${item.id}.webp`, native: { width: meta.width, height: meta.height, format: meta.format, sha256: hash(bytes) }, sourceSha256: '', publicSha256: '', adaptation: { width: 1920, height: 1080, fit: 'fill', cropped: false, note: 'Complete native frame resampled to runtime 16:9; no crop or compositing.' } })
  }
} else manifest = JSON.parse(await readFile(manifestURL, 'utf8'))
for (const item of manifest.assets) {
  const nativeBytes = await readFile(new URL(item.nativeFile, root)), sourceBytes = await readFile(new URL(item.sourceFile, root))
  if (hash(nativeBytes) !== item.native.sha256) throw Error('Native provenance mismatch')
  const encoded = await sharp(sourceBytes).webp({ quality: 94, effort: 6 }).toBuffer()
  await writeFile(new URL(item.publicFile, root), encoded)
  item.sourceSha256 = hash(sourceBytes); item.publicSha256 = hash(encoded)
}
await writeFile(manifestURL, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Packaged ${manifest.assets.length} full-frame chapter-three images.`)
