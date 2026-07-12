import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { inspectImage } from './imageInspector.js'

async function portrait(background: { r: number; g: number; b: number; alpha: number }) {
  const width = 80
  const height = 128
  const pixels = Buffer.alloc(width * height * 4)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = background.r
    pixels[offset + 1] = background.g
    pixels[offset + 2] = background.b
    pixels[offset + 3] = background.alpha
  }
  for (let y = 18; y < 122; y += 1) for (let x = 20; x < 60; x += 1) {
    const offset = (y * width + x) * 4
    pixels[offset] = 128
    pixels[offset + 1] = 36
    pixels[offset + 2] = 64
    pixels[offset + 3] = 255
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

describe('image inspector analysis', () => {
  it('prefers an existing transparent portrait for a sprite without matte removal', async () => {
    const result = await inspectImage(await portrait({ r: 0, g: 0, b: 0, alpha: 0 }))
    expect(result.analysis).toMatchObject({
      background: 'transparent',
      recommendedPurpose: 'sprite',
      recommendedRecipe: { removeWhite: false, trim: true },
    })
    expect(result.analysis.alphaCoverage).toBeGreaterThan(0.4)
  })

  it('recommends connected matte removal for a white-background portrait', async () => {
    const result = await inspectImage(await portrait({ r: 255, g: 255, b: 255, alpha: 255 }))
    expect(result.analysis).toMatchObject({
      background: 'flat-light',
      recommendedPurpose: 'sprite',
      recommendedRecipe: { removeWhite: true, trim: true },
    })
    expect(result.analysis.confidence).toBeGreaterThanOrEqual(0.7)
    expect(result.analysis.warnings).toEqual([])
  })

  it('warns that a complex background cannot be cut out reliably', async () => {
    const width = 96
    const height = 128
    const raw = Buffer.alloc(width * height * 3)
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3
      raw[offset] = (x * 47 + y * 13) % 256
      raw[offset + 1] = (x * 19 + y * 61) % 256
      raw[offset + 2] = (x * 73 + y * 29) % 256
    }
    const result = await inspectImage(await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer())
    expect(result.analysis.background).toBe('complex')
    expect(result.analysis.recommendedRecipe.removeWhite).toBe(false)
    expect(result.analysis.warnings.join('')).toContain('复杂背景')
  })

  it('recommends a wide opaque image as a background', async () => {
    const source = await sharp({ create: { width: 320, height: 180, channels: 3, background: '#4b6f8a' } }).png().toBuffer()
    const result = await inspectImage(source)
    expect(result.analysis).toMatchObject({ background: 'flat-color', recommendedPurpose: 'background' })
  })
})
