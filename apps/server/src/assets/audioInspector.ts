export interface AudioInspection {
  extension: 'mp3' | 'wav' | 'ogg'
  mimeType: 'audio/mpeg' | 'audio/wav' | 'audio/ogg'
}

const MPEG1_BITRATES = {
  3: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
} as const
const MPEG2_BITRATES = {
  3: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  1: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
} as const

function id3PayloadOffset(buffer: Buffer): number | null {
  if (buffer.subarray(0, 3).toString('ascii') !== 'ID3') return 0
  if (buffer.length < 10 || buffer[3]! < 2 || buffer[3]! > 4) return null
  const sizeBytes = [buffer[6]!, buffer[7]!, buffer[8]!, buffer[9]!]
  if (sizeBytes.some((byte) => (byte & 0x80) !== 0)) return null
  const size = sizeBytes.reduce((total, byte) => (total << 7) | byte, 0)
  const footer = buffer[3] === 4 && (buffer[5]! & 0x10) !== 0 ? 10 : 0
  const offset = 10 + size + footer
  return offset <= buffer.length ? offset : null
}

function mpegFrameLength(buffer: Buffer, offset: number): number | null {
  if (offset + 4 > buffer.length) return null
  const first = buffer[offset]!
  const second = buffer[offset + 1]!
  const third = buffer[offset + 2]!
  if (first !== 0xff || (second & 0xe0) !== 0xe0) return null
  const version = (second >> 3) & 0x03
  const layer = (second >> 1) & 0x03
  const bitrateIndex = (third >> 4) & 0x0f
  const sampleRateIndex = (third >> 2) & 0x03
  const padding = (third >> 1) & 0x01
  if (version === 1 || layer === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return null

  const rates = version === 3 ? MPEG1_BITRATES : MPEG2_BITRATES
  const bitrate = rates[layer as 1 | 2 | 3][bitrateIndex]! * 1000
  const baseSampleRate = [44_100, 48_000, 32_000][sampleRateIndex]!
  const sampleRate = version === 3 ? baseSampleRate : version === 2 ? baseSampleRate / 2 : baseSampleRate / 4
  if (layer === 3) return Math.floor((12 * bitrate) / sampleRate + padding) * 4
  const coefficient = layer === 1 && version !== 3 ? 72 : 144
  return Math.floor((coefficient * bitrate) / sampleRate + padding)
}

function isMp3(buffer: Buffer): boolean {
  const offset = id3PayloadOffset(buffer)
  if (offset === null) return false
  const frameLength = mpegFrameLength(buffer, offset)
  if (!frameLength || offset + frameLength > buffer.length) return false
  const next = offset + frameLength
  if (next === buffer.length) return true
  if (buffer.length - next === 128 && buffer.subarray(next, next + 3).toString('ascii') === 'TAG') return true
  const nextFrameLength = mpegFrameLength(buffer, next)
  return Boolean(nextFrameLength && next + nextFrameLength <= buffer.length)
}

function isWav(buffer: Buffer): boolean {
  if (buffer.length < 44 || buffer.subarray(0, 4).toString('ascii') !== 'RIFF' || buffer.subarray(8, 12).toString('ascii') !== 'WAVE') return false
  if (buffer.readUInt32LE(4) + 8 > buffer.length) return false
  let offset = 12
  let hasFormat = false
  let hasData = false
  while (offset + 8 <= buffer.length) {
    const id = buffer.subarray(offset, offset + 4).toString('ascii')
    const size = buffer.readUInt32LE(offset + 4)
    const end = offset + 8 + size
    if (end > buffer.length) return false
    if (id === 'fmt ' && size >= 16) hasFormat = true
    if (id === 'data' && size > 0) hasData = true
    offset = end + (size % 2)
  }
  return hasFormat && hasData
}

function oggCrc(buffer: Buffer): number {
  let crc = 0
  for (const byte of buffer) {
    crc = (crc ^ (byte << 24)) >>> 0
    for (let bit = 0; bit < 8; bit += 1) crc = ((crc & 0x80000000) !== 0 ? (crc << 1) ^ 0x04c11db7 : crc << 1) >>> 0
  }
  return crc
}

function isOgg(buffer: Buffer): boolean {
  if (buffer.length < 28 || buffer.subarray(0, 4).toString('ascii') !== 'OggS' || buffer[4] !== 0 || (buffer[5]! & 0x02) === 0) return false
  if (buffer.readUInt32LE(18) !== 0) return false
  const segmentCount = buffer[26]!
  if (segmentCount === 0 || buffer.length < 27 + segmentCount) return false
  let payloadLength = 0
  for (let index = 0; index < segmentCount; index += 1) payloadLength += buffer[27 + index]!
  if (buffer[26 + segmentCount] === 255) return false
  const payloadOffset = 27 + segmentCount
  const pageEnd = payloadOffset + payloadLength
  if (payloadLength < 7 || buffer.length < pageEnd) return false
  const payload = buffer.subarray(payloadOffset, pageEnd)
  const isOpus = payload.subarray(0, 8).toString('ascii') === 'OpusHead'
  const isVorbis = payload[0] === 1 && payload.subarray(1, 7).toString('ascii') === 'vorbis'
  if (!isOpus && !isVorbis) return false
  const expectedCrc = buffer.readUInt32LE(22)
  const page = Buffer.from(buffer.subarray(0, pageEnd))
  page.fill(0, 22, 26)
  return oggCrc(page) === expectedCrc
}

export function inspectAudio(buffer: Buffer): AudioInspection {
  if (isMp3(buffer)) return { extension: 'mp3', mimeType: 'audio/mpeg' }
  if (isWav(buffer)) return { extension: 'wav', mimeType: 'audio/wav' }
  if (isOgg(buffer)) return { extension: 'ogg', mimeType: 'audio/ogg' }
  throw new Error('音频无法识别、结构损坏或格式不受支持')
}
