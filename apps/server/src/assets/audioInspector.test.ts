import { describe, expect, it } from 'vitest'
import { inspectAudio } from './audioInspector.js'

function mpeg1Layer3Frame(): Buffer {
  const frame = Buffer.alloc(417)
  frame.set([0xff, 0xfb, 0x90, 0x64])
  return frame
}

function oggCrc(buffer: Buffer): number {
  let crc = 0
  for (const byte of buffer) {
    crc = (crc ^ (byte << 24)) >>> 0
    for (let bit = 0; bit < 8; bit += 1) crc = ((crc & 0x80000000) !== 0 ? (crc << 1) ^ 0x04c11db7 : crc << 1) >>> 0
  }
  return crc
}

function opusOggPage(): Buffer {
  const payload = Buffer.alloc(19)
  payload.write('OpusHead', 0, 'ascii')
  payload[8] = 1
  payload[9] = 2
  payload.writeUInt32LE(48_000, 12)
  const page = Buffer.alloc(28 + payload.length)
  page.write('OggS', 0, 'ascii')
  page[4] = 0
  page[5] = 0x02
  page.writeUInt32LE(1, 14)
  page[26] = 1
  page[27] = payload.length
  payload.copy(page, 28)
  page.writeUInt32LE(oggCrc(page), 22)
  return page
}

describe('audio inspector', () => {
  it('rejects arbitrary bytes with a short MPEG sync prefix', () => {
    expect(() => inspectAudio(Buffer.concat([Buffer.from([0xff, 0xe0]), Buffer.from('<script>alert(1)</script>')]))).toThrow(/音频|MP3|格式/)
  })

  it('rejects an ID3 tag that contains no MPEG audio frame', () => {
    const fake = Buffer.concat([Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x04', 'binary'), Buffer.from('fake')])
    expect(() => inspectAudio(fake)).toThrow(/音频|MP3|格式/)
  })

  it('accepts a complete structurally valid MPEG-1 Layer III frame', () => {
    expect(inspectAudio(mpeg1Layer3Frame())).toEqual({ extension: 'mp3', mimeType: 'audio/mpeg' })
  })

  it('rejects a forged Ogg page without an audio identification header', () => {
    const fake = Buffer.alloc(29)
    fake.write('OggS', 0, 'ascii')
    fake[26] = 1
    fake[27] = 1
    fake[28] = 0x58
    expect(() => inspectAudio(fake)).toThrow(/音频|结构|格式/)
  })

  it('accepts a checksummed Ogg Opus identification page', () => {
    expect(inspectAudio(opusOggPage())).toEqual({ extension: 'ogg', mimeType: 'audio/ogg' })
  })
})
