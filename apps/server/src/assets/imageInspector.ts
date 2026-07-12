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
  analysis: ImageAnalysis
}

export type ImageBackgroundKind = 'transparent' | 'flat-light' | 'flat-color' | 'complex'

export interface ImageAnalysis {
  alphaCoverage: number
  borderLuminance: number
  borderVariance: number
  background: ImageBackgroundKind
  foregroundBounds: { x: number; y: number; width: number; height: number } | null
  recommendedPurpose: 'sprite' | 'cg' | 'background'
  recommendedRecipe: { removeWhite: boolean; trim: boolean; whiteThreshold: number; feather: number }
  confidence: number
  reasons: string[]
  warnings: string[]
}

const round = (value: number) => Math.round(value * 10_000) / 10_000

async function analyzeImage(buffer: Buffer, sourceWidth: number, sourceHeight: number): Promise<ImageAnalysis> {
  const { data, info } = await sharp(buffer, { limitInputPixels: 50_000_000, page: 0 })
    .rotate()
    .ensureAlpha()
    .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let transparent = 0
  const border: Array<[number, number, number]> = []
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * channels
    const alpha = data[offset + 3] ?? 255
    if (alpha < 245) transparent += 1
    if ((x === 0 || y === 0 || x === width - 1 || y === height - 1) && alpha > 16) {
      border.push([data[offset]!, data[offset + 1]!, data[offset + 2]!])
    }
  }
  const alphaCoverage = transparent / (width * height)
  const mean = border.reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0])
  const divisor = Math.max(1, border.length)
  mean[0] /= divisor; mean[1] /= divisor; mean[2] /= divisor
  const luminance = (0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]) / 255
  const variance = border.reduce((sum, pixel) => sum
    + ((pixel[0] - mean[0]) ** 2 + (pixel[1] - mean[1]) ** 2 + (pixel[2] - mean[2]) ** 2) / 3, 0) / divisor / (255 ** 2)

  let background: ImageBackgroundKind
  if (alphaCoverage >= 0.02) background = 'transparent'
  else if (luminance >= 0.86 && variance <= 0.008) background = 'flat-light'
  else if (variance <= 0.012) background = 'flat-color'
  else background = 'complex'

  const aspectRatio = sourceWidth / sourceHeight
  const recommendedPurpose = aspectRatio >= 1.35
    ? 'background'
    : aspectRatio <= 0.9 && background !== 'complex' ? 'sprite' : 'cg'
  const removeWhite = recommendedPurpose === 'sprite' && background === 'flat-light'
  const warnings = background === 'complex'
    ? ['图片边缘颜色变化较大，属于复杂背景；本地工具无法可靠语义抠图，建议上传透明 PNG 或纯色背景原图。']
    : []
  const reasons = [
    background === 'transparent' ? '图片已有可用透明通道。'
      : background === 'flat-light' ? '图片边缘接近均匀浅色，适合边缘连通去底。'
        : background === 'flat-color' ? '图片边缘颜色均匀。' : '图片边缘颜色复杂。',
    recommendedPurpose === 'sprite' ? '纵向构图适合角色立绘。'
      : recommendedPurpose === 'background' ? '宽屏构图适合场景背景。' : '当前构图更适合作为 CG。',
  ]
  const confidence = background === 'complex' ? 0.62 : background === 'flat-light' ? 0.9 : background === 'transparent' ? 0.96 : 0.78

  let minX = width; let minY = height; let maxX = -1; let maxY = -1
  if (background !== 'complex') {
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels
      const alpha = data[offset + 3] ?? 255
      const distance = Math.sqrt((data[offset]! - mean[0]) ** 2 + (data[offset + 1]! - mean[1]) ** 2 + (data[offset + 2]! - mean[2]) ** 2)
      const foreground = background === 'transparent' ? alpha >= 32 : distance >= 45
      if (foreground) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
    }
  }
  const foregroundBounds = maxX < 0 ? null : {
    x: Math.round(minX / width * sourceWidth), y: Math.round(minY / height * sourceHeight),
    width: Math.max(1, Math.round((maxX - minX + 1) / width * sourceWidth)),
    height: Math.max(1, Math.round((maxY - minY + 1) / height * sourceHeight)),
  }
  return {
    alphaCoverage: round(alphaCoverage), borderLuminance: round(luminance), borderVariance: round(variance),
    background, foregroundBounds, recommendedPurpose,
    recommendedRecipe: { removeWhite, trim: recommendedPurpose !== 'background', whiteThreshold: 245, feather: 8 },
    confidence, reasons, warnings,
  }
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
    analysis: await analyzeImage(buffer, metadata.width, metadata.height),
  }
}
