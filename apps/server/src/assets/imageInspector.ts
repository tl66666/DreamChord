import sharp from 'sharp'

const MIME_TYPES: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }

export interface ImageInspection {
  format: 'png' | 'jpeg' | 'webp' | 'gif'
  mimeType: string
  width: number
  height: number
  hasAlpha: boolean
  animated: boolean
  pages: number
}

export async function inspectImage(buffer: Buffer): Promise<ImageInspection> {
  let metadata: sharp.Metadata
  try { metadata = await sharp(buffer, { failOn: 'error', limitInputPixels: 50_000_000, animated: true }).metadata() }
  catch { throw new Error('图片无法解码或文件已损坏') }
  const format = metadata.format
  if (!format || !(format in MIME_TYPES) || !metadata.width || !metadata.height) throw new Error('不支持的图片格式')
  if (metadata.width > 12_000 || metadata.height > 12_000 || metadata.width * metadata.height > 40_000_000) throw new Error('图片尺寸超过安全限制')
  const pages = metadata.pages ?? 1
  return {
    format: format as ImageInspection['format'], mimeType: MIME_TYPES[format]!, width: metadata.width, height: metadata.height,
    hasAlpha: Boolean(metadata.hasAlpha), animated: pages > 1, pages,
  }
}
