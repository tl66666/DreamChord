/** Reproduce chapter art from committed native originals; --verify never writes files. */
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from '../apps/server/node_modules/sharp/lib/index.js'
const root = new URL('../', import.meta.url)
const hash = value => createHash('sha256').update(value).digest('hex')
const manifest = JSON.parse(await readFile(new URL('source-assets/paint-chapter-one/art-manifest.json', root), 'utf8'))
for (const asset of manifest.assets) {
  const native = await readFile(new URL(asset.nativeFile, root))
  if (hash(native) !== asset.native.sha256) throw new Error(`Native changed: ${asset.id}`)
  const source = await sharp(native).resize(1920, 1080, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().png().toBuffer()
  const runtime = await sharp(source).webp({ quality: 94, effort: 6 }).toBuffer()
  if (hash(source) !== asset.sourceSha256 || hash(runtime) !== asset.publicSha256) throw new Error(`Encoding differs from release: ${asset.id}`)
  if (process.argv.includes('--verify')) {
    if (hash(await readFile(new URL(asset.sourceFile, root))) !== asset.sourceSha256 || hash(await readFile(new URL(asset.publicFile, root))) !== asset.publicSha256) throw new Error(`File changed: ${asset.id}`)
  } else {
    await writeFile(new URL(asset.sourceFile, root), source)
    await writeFile(new URL(asset.publicFile, root), runtime)
  }
}
console.log(`Reproduced ${manifest.assets.length} native→PNG→WebP assets byte-for-byte.`)
