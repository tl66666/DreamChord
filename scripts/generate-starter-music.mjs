import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'assets', 'music-packs', 'dreamchord-starter', 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const composers = {
  'dreamchord-twilight-corridor': twilight,
  'dreamchord-rain-window': rainWindow,
  'dreamchord-branch-pulse': branchPulse,
}

for (const track of manifest.tracks) {
  const compose = composers[track.id]
  if (!compose) throw new Error(`没有为 ${track.id} 配置作曲器`)
  const samples = compose(track.sampleRate)
  const output = path.resolve(path.dirname(manifestPath), track.outputFile)
  mkdirSync(path.dirname(output), { recursive: true })
  const wav = encodeWav(samples, track.sampleRate)
  writeFileSync(output, wav)
  track.durationSeconds = Number((samples.length / track.sampleRate).toFixed(2))
  track.sha256 = createHash('sha256').update(wav).digest('hex')
  console.log(`✓ ${track.name} ${track.durationSeconds.toFixed(1)}s`)
}
manifest.generatedAt = new Date().toISOString()
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log('梦弦原创示例音乐生成完成。')

function twilight(rate) {
  const bpm = 80; const beats = 32; const length = Math.round(beats * 60 / bpm * rate); const out = new Float64Array(length)
  const chords = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]]
  for (let beat = 0; beat < beats; beat += 1) {
    const chord = chords[Math.floor(beat / 4) % chords.length]
    addNote(out, rate, beat * 60 / bpm, 60 / bpm, chord[beat % 3] * 2, 0.16, 'soft')
    for (const frequency of chord) addNote(out, rate, beat * 60 / bpm, 60 / bpm * 4, frequency, 0.035, 'pad')
    if (beat % 2 === 0) addNote(out, rate, beat * 60 / bpm, 60 / bpm * 1.8, chord[0] / 2, 0.08, 'soft')
  }
  return finalize(out, 0.82)
}

function rainWindow(rate) {
  const bpm = 72; const beats = 24; const length = Math.round(beats * 60 / bpm * rate); const out = new Float64Array(length)
  const melody = [440, 392, 329.63, 293.66, 329.63, 261.63, 246.94, 293.66]
  for (let beat = 0; beat < beats; beat += 1) {
    if (beat % 2 === 0) addNote(out, rate, beat * 60 / bpm, 60 / bpm * 1.65, melody[(beat / 2) % melody.length], 0.16, 'pluck')
    if (beat % 4 === 0) addNote(out, rate, beat * 60 / bpm, 60 / bpm * 3.7, [146.83, 130.81, 110, 130.81][(beat / 4) % 4], 0.08, 'soft')
  }
  let seed = 20261027
  for (let i = 0; i < out.length; i += 1) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
    const noise = ((seed >>> 0) / 0xffffffff - 0.5) * 0.006
    out[i] += noise * (0.4 + 0.6 * Math.sin(Math.PI * i / out.length) ** 2)
  }
  return finalize(out, 0.88)
}

function branchPulse(rate) {
  const bpm = 100; const beats = 32; const length = Math.round(beats * 60 / bpm * rate); const out = new Float64Array(length)
  const roots = [110, 110, 103.83, 92.5]
  for (let beat = 0; beat < beats; beat += 1) {
    const root = roots[Math.floor(beat / 8) % roots.length]
    addNote(out, rate, beat * 60 / bpm, 60 / bpm * 0.72, root, 0.18, 'pulse')
    if (beat % 2 === 1) addNote(out, rate, beat * 60 / bpm, 60 / bpm * 0.45, root * (beat % 4 === 1 ? 2.378 : 2.52), 0.07, 'pluck')
    if (beat % 8 === 0) addNote(out, rate, beat * 60 / bpm, 60 / bpm * 7.5, root * 1.5, 0.04, 'pad')
  }
  return finalize(out, 0.9)
}

function addNote(buffer, rate, startSeconds, durationSeconds, frequency, gain, timbre) {
  const start = Math.round(startSeconds * rate); const duration = Math.round(durationSeconds * rate)
  for (let offset = 0; offset < duration && start + offset < buffer.length; offset += 1) {
    const t = offset / rate; const position = offset / duration
    const envelope = timbre === 'pad' ? Math.sin(Math.PI * position) ** 1.5 : Math.min(1, position * 25) * Math.exp(-position * (timbre === 'pluck' ? 5.5 : 2.2)) * Math.min(1, (1 - position) * 18)
    const phase = 2 * Math.PI * frequency * t
    const wave = timbre === 'pulse' ? Math.sin(phase) + 0.28 * Math.sin(phase * 2) : Math.sin(phase) + 0.18 * Math.sin(phase * 2) + 0.07 * Math.sin(phase * 3)
    buffer[start + offset] += wave * envelope * gain
  }
}

function finalize(samples, targetPeak) {
  const fade = Math.min(2400, Math.floor(samples.length / 10)); let peak = 0
  for (let i = 0; i < samples.length; i += 1) { const edge = Math.min(1, i / fade, (samples.length - 1 - i) / fade); samples[i] *= Math.max(0, edge); peak = Math.max(peak, Math.abs(samples[i])) }
  const scale = peak ? targetPeak / peak : 1
  return Float64Array.from(samples, (sample) => Math.max(-1, Math.min(1, sample * scale)))
}

function encodeWav(samples, sampleRate) {
  const buffer = Buffer.alloc(44 + samples.length * 2)
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples.length * 2, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i += 1) buffer.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2)
  return buffer
}
