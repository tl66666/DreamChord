import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { processImage } from './imageProcessor.js'

describe('image processor', () => {
  it('removes a near-white matte and creates a stable transparent sprite canvas', async () => {
    const raw = Buffer.alloc(20 * 20 * 3, 255)
    for (let y = 5; y < 18; y += 1) for (let x = 6; x < 14; x += 1) {
      const offset = (y * 20 + x) * 3; raw[offset] = 220; raw[offset + 1] = 30; raw[offset + 2] = 60
    }
    const source = await sharp(raw, { raw: { width: 20, height: 20, channels: 3 } }).png().toBuffer()
    const result = await processImage(source, { purpose: 'sprite', removeWhite: true, whiteThreshold: 245, feather: 8, trim: true })
    const metadata = await sharp(result.buffer).metadata()
    const corner = await sharp(result.buffer).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer()
    expect(metadata).toMatchObject({ width: 1024, height: 1536, format: 'png', hasAlpha: true })
    expect(corner[3]).toBe(0)
  })

  it('creates inspectable CG and background derivatives without changing the original buffer', async () => {
    const source = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#335577' } }).jpeg().toBuffer()
    const copy = Buffer.from(source)
    const cg = await processImage(source, { purpose: 'cg', trim: false })
    const background = await processImage(source, { purpose: 'background', trim: false })
    expect(await sharp(cg.buffer).metadata()).toMatchObject({ width: 1920, height: 1080, format: 'webp' })
    expect(await sharp(background.buffer).metadata()).toMatchObject({ width: 1920, height: 1080, format: 'webp' })
    expect(source.equals(copy)).toBe(true)
  })

  it('removes only white matte pixels connected to the image edge', async () => {
    const size = 9
    const raw = Buffer.alloc(size * size * 3, 255)
    for (let y = 2; y <= 6; y += 1) for (let x = 2; x <= 6; x += 1) {
      if (x !== 2 && x !== 6 && y !== 2 && y !== 6) continue
      const offset = (y * size + x) * 3
      raw[offset] = 24; raw[offset + 1] = 24; raw[offset + 2] = 24
    }
    const source = await sharp(raw, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer()
    const result = await processImage(source, { purpose: 'sprite', removeWhite: true, whiteThreshold: 245, feather: 0, trim: false })
    const pixels = await sharp(result.buffer).ensureAlpha().raw().toBuffer()
    const alphaAt = (x: number, y: number) => pixels[(y * 1024 + x) * 4 + 3]
    expect(alphaAt(56, 568)).toBe(0)
    expect(alphaAt(512, 1024)).toBe(255)
  })
})
