import sharp from 'sharp'
import { inspectImage, type ImageInspection } from './imageInspector.js'

export interface ImageRecipe {
  purpose: 'sprite' | 'cg' | 'background'
  removeWhite?: boolean
  whiteThreshold?: number
  feather?: number
  trim?: boolean
}

export interface ProcessedImage {
  buffer: Buffer
  inspection: ImageInspection
  extension: 'png' | 'webp'
}

async function removeWhiteMatte(buffer: Buffer, threshold: number, feather: number): Promise<Buffer> {
  const { data, info } = await sharp(buffer, { limitInputPixels: 40_000_000 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const edge = Math.max(0, threshold - feather)
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const whiteness = Math.min(data[offset]!, data[offset + 1]!, data[offset + 2]!)
    if (whiteness >= threshold) data[offset + 3] = 0
    else if (feather > 0 && whiteness > edge) data[offset + 3] = Math.min(data[offset + 3]!, Math.round(255 * (threshold - whiteness) / feather))
  }
  return sharp(data, { raw: info }).png().toBuffer()
}

export async function processImage(source: Buffer, recipe: ImageRecipe): Promise<ProcessedImage> {
  await inspectImage(source)
  const threshold = Math.max(180, Math.min(255, recipe.whiteThreshold ?? 245))
  const feather = Math.max(0, Math.min(40, recipe.feather ?? 8))
  let working = recipe.removeWhite ? await removeWhiteMatte(source, threshold, feather) : Buffer.from(source)
  let pipeline = sharp(working, { limitInputPixels: 40_000_000 }).rotate()
  if (recipe.trim) pipeline = pipeline.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })

  let buffer: Buffer
  let extension: ProcessedImage['extension']
  if (recipe.purpose === 'sprite') {
    buffer = await pipeline.resize(1024, 1536, { fit: 'contain', position: 'bottom', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer()
    extension = 'png'
  } else if (recipe.purpose === 'background') {
    buffer = await pipeline.resize(1920, 1080, { fit: 'cover', position: 'centre' }).webp({ quality: 88 }).toBuffer()
    extension = 'webp'
  } else {
    buffer = await pipeline.resize(1920, 1080, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90, alphaQuality: 100 }).toBuffer()
    extension = 'webp'
  }
  working = Buffer.alloc(0)
  return { buffer, inspection: await inspectImage(buffer), extension }
}
