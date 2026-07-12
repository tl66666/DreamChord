import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { inspectImage } from './imageInspector.js'

describe('image inspector', () => {
  it('derives trusted metadata from decoded bytes', async () => {
    const png = await sharp({ create: { width: 24, height: 32, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer()
    await expect(inspectImage(png)).resolves.toMatchObject({ format: 'png', mimeType: 'image/png', width: 24, height: 32, hasAlpha: true })
  })

  it('rejects malformed bytes and excessive dimensions', async () => {
    await expect(inspectImage(Buffer.from('not-an-image'))).rejects.toThrow('无法解码')
    const wide = await sharp({ create: { width: 12001, height: 1, channels: 3, background: 'white' } }).png().toBuffer()
    await expect(inspectImage(wide)).rejects.toThrow('尺寸')
  })
})
