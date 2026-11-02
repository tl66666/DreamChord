import sharp from '../apps/server/node_modules/sharp/lib/index.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { createHash } from 'node:crypto'

const root = resolve(import.meta.dirname, '..')
const sources = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const out = resolve(root, 'apps/web/public/assets/curtain-call')
mkdirSync(out, { recursive: true })
const provenance = { generated: true, tool: 'OpenAI imagegen', date: '2026-10-29', description: 'Original university graduation cast and locations. No commercial game art.', files: [] }
for (const [name, source] of Object.entries(sources)) {
  const bytes = readFileSync(source)
  if (['zhi', 'tang', 'lin'].includes(name)) {
    const { width, height } = await sharp(bytes).metadata()
    for (const [i, expression] of ['normal', 'sad', 'smile'].entries()) {
      const left = Math.round(i * width / 3), right = Math.round((i + 1) * width / 3)
      const crop = await sharp(bytes).extract({ left, top: 0, width: right - left, height }).png().toBuffer()
      const trimmed = await sharp(crop).trim({ threshold: 8 }).png().toBuffer()
      const resized = await sharp(trimmed).resize(1000, 1500, { fit: 'inside', withoutEnlargement: false }).png().toBuffer()
      const size = await sharp(resized).metadata()
      const target = `${name}-${expression}.png`
      await sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: resized, left: Math.floor((1024 - size.width) / 2), top: 1536 - size.height }]).png().toFile(resolve(out, target))
      provenance.files.push({ file: target, sourceFile: basename(source), sourceSha256: createHash('sha256').update(bytes).digest('hex') })
    }
  } else {
    const target = `${name}.webp`
    await sharp(bytes).resize(1920, 1080, { fit: 'cover' }).webp({ quality: 91 }).toFile(resolve(out, target))
    provenance.files.push({ file: target, sourceFile: basename(source), sourceSha256: createHash('sha256').update(bytes).digest('hex') })
  }
}
writeFileSync(resolve(out, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n')
console.log(`Prepared ${provenance.files.length} full-sized scene and character assets.`)
