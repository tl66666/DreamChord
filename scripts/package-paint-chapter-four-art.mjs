/** Retain complete native frames and the sprites' generated alpha. */
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from '../apps/server/node_modules/sharp/lib/index.js'
const root = new URL('../', import.meta.url), source = 'source-assets/paint-chapter-four/'
const sha = b => createHash('sha256').update(b).digest('hex'), manifestFile = new URL(source + 'art-manifest.json', root)
await mkdir(new URL(source, root), { recursive: true })
let manifest
if (process.argv.includes('--ingest')) {
  const items = JSON.parse(await readFile(new URL('.runtime/paint-chapter-four-art-input.json', root), 'utf8'))
  manifest = { createdAt: '2026-11-09', generator: 'built-in image_gen.imagegen', chapterTitle: '第四章 · 另一双手', assets: [] }
  for (const a of items) {
    if (!['liu-jian-stage', 'shen-yun-stage', 'commission-desk', 'hall-afternoon'].includes(a.id)) throw Error('Unexpected chapter art ID')
    const nativeFile = source + a.id + '-native.png', publicFile = `apps/web/public/assets/${a.kind === 'sprite' ? 'paint-world' : 'paint-chapter-four'}/${a.id}.webp`
    await copyFile(a.generationSourcePath, new URL(nativeFile, root))
    const bytes = await readFile(new URL(nativeFile, root)), meta = await sharp(bytes).metadata()
    if (meta.format !== 'png' || !meta.width || !meta.height || (a.kind === 'sprite' && !meta.hasAlpha)) throw Error('Invalid native chapter art')
    manifest.assets.push({ id: a.id, kind: a.kind, prompt: a.prompt, referenceFile: a.ref.replace(/.*\/项目\//, ''), nativeFile, publicFile, publicUrl: publicFile.slice('apps/web/public'.length), nativeSha256: sha(bytes), nativeWidth: meta.width, nativeHeight: meta.height, generatedAlpha: a.kind === 'sprite', cropped: false })
  }
} else manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
for (const a of manifest.assets) {
  const bytes = await readFile(new URL(a.nativeFile, root))
  if (sha(bytes) !== a.nativeSha256) throw Error('Native art SHA mismatch')
  let pipeline = sharp(bytes)
  if (a.kind === 'background') pipeline = pipeline.resize(1920, 1080, { fit: 'fill' })
  const output = await pipeline.webp({ quality: 94, alphaQuality: 100, effort: 6 }).toBuffer()
  await mkdir(new URL('./', new URL(a.publicFile, root)), { recursive: true })
  await writeFile(new URL(a.publicFile, root), output)
  a.publicSha256 = sha(output)
}
await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Packaged ${manifest.assets.length} original chapter assets; no crop, sprite alpha preserved.`)
