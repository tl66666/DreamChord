import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from '../apps/server/node_modules/sharp/lib/index.js'
const root = new URL('../', import.meta.url), source = 'source-assets/paint-world/', output = 'apps/web/public/assets/paint-world/'
const sha = b => createHash('sha256').update(b).digest('hex')
await mkdir(new URL(source, root), { recursive: true }); await mkdir(new URL(output, root), { recursive: true })
const manifestFile = new URL(source + 'art-manifest.json', root)
let manifest
if (process.argv.includes('--ingest')) {
  const items = JSON.parse(await readFile(new URL('.runtime/world-art-input.json', root), 'utf8'))
  manifest = { createdAt: '2026-11-09', generator: 'built-in image_gen.imagegen', purpose: 'Original supporting-character archive portraits; opaque, not stage sprites or trained voice identities.', assets: [] }
  for (const item of items) {
    if (!['liu-jian', 'shen-yun'].includes(item.id)) throw Error('Unexpected portrait ID')
    const nativeFile = source + item.id + '-native.png'
    await copyFile(item.nativePath, new URL(nativeFile, root))
    const bytes = await readFile(new URL(nativeFile, root)), m = await sharp(bytes).metadata()
    manifest.assets.push({ id: item.id, prompt: item.prompt, generationSourcePath: item.nativePath, nativeFile, nativeSha256: sha(bytes), nativeWidth: m.width, nativeHeight: m.height, publicFile: output + item.id + '.webp', cropped: false })
  }
} else manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
for (const a of manifest.assets) {
  const bytes = await readFile(new URL(a.nativeFile, root))
  if (sha(bytes) !== a.nativeSha256) throw Error('Native portrait SHA mismatch')
  const encoded = await sharp(bytes).resize(1024, 1024, { fit: 'fill' }).webp({ quality: 93, effort: 6 }).toBuffer()
  await writeFile(new URL(a.publicFile, root), encoded)
  a.publicSha256 = sha(encoded)
}
await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Packaged ${manifest.assets.length} original archive portraits.`)
