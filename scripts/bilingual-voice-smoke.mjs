import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const origin = 'http://127.0.0.1:3001'
const login = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'demo', password: 'demo123' }) })
if (!login.ok) throw new Error('Demo login failed')
const { token } = await login.json()
async function api(route, body) {
  const response = await fetch(`${origin}/api/voices${route}`, { headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`)
  return value
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let health
for (let attempt = 0; attempt < 90; attempt++) {
  health = await api('/provider/health')
  if (health.ok) break
  await delay(1500)
}
if (!health?.ok || !['cosyvoice', 'gpt-sovits'].includes(health.provider)) throw new Error('Bilingual voice engine is not ready')
const profiles = await api('/profiles')
const voice = profiles.find((profile) => profile.id === 'cast-voice-yuki' && profile.bindings.some((item) => item.project.id === 'dreamchord-first-thread')) || profiles.find((profile) => profile.id === 'cast-voice-miya')
const binding = voice?.bindings.find((item) => item.project.id === 'dreamchord-first-thread')
if (!binding) throw new Error('A bilingual cast voice must be bound to the demo')
const report = { generatedAt: new Date().toISOString(), provider: health.provider, takes: [] }
for (const [language, sourceText] of [['zh', '先别着急。我们一起把故事写完，好吗？'], ['ja', '不要害怕，我会在钟楼下等你。明天放学后，一起去看海吧。']]) {
  const translation = language === 'ja' ? await api('/translate', { text: sourceText, targetLanguage: 'ja' }) : undefined
  const text = translation?.text || sourceText
  const reference = voice.references.find((item) => item.language === language)
  if (!reference) throw new Error(`Missing reference: ${language}`)
  const started = Date.now()
  let job = await api('/generate', { projectId: binding.project.id, characterId: binding.character.id, referenceId: reference.id, language, text, sourceText, sourceLanguage: 'zh', directionMode: 'auto' })
  const deadline = Date.now() + 180000
  while (['queued', 'running'].includes(job.status) && Date.now() < deadline) { await delay(1500); job = await api(`/jobs/${job.id}`) }
  if (job.status !== 'completed' || !job.outputUrl) throw new Error(job.errorMessage || 'Synthesis timeout')
  const response = await fetch(`${origin}${job.outputUrl}`)
  if (!response.ok) throw new Error('Generated media cannot be served')
  const wav = Buffer.from(await response.arrayBuffer())
  if (wav.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Invalid WAV')
  const rate = wav.readUInt32LE(24)
  let offset = 12, dataOffset = -1, dataLength = 0
  while (offset + 8 <= wav.length) {
    const length = wav.readUInt32LE(offset + 4)
    if (wav.toString('ascii', offset, offset + 4) === 'data') { dataOffset = offset + 8; dataLength = length; break }
    offset += 8 + length + (length % 2)
  }
  if (dataOffset < 0 || dataOffset + dataLength > wav.length) throw new Error('Missing WAV audio')
  let squareSum = 0, peak = 0, clippedSamples = 0
  for (let index = dataOffset; index < dataOffset + dataLength; index += 2) {
    const sample = wav.readInt16LE(index) / 32768
    squareSum += sample * sample; peak = Math.max(peak, Math.abs(sample)); if (Math.abs(sample) >= 0.999) clippedSamples++
  }
  const durationSeconds = dataLength / 2 / rate
  const rms = Math.sqrt(squareSum / (dataLength / 2))
  if (durationSeconds < 0.5 || durationSeconds > 45 || rms < 0.001 || clippedSamples / (dataLength / 2) > 0.01) throw new Error('Audio technical check failed')
  const output = path.join(root, '.runtime/voice-auditions', `bilingual-new-line-${language}.wav`)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, wav)
  const take = { language, sourceText, text, translationSource: translation?.source, jobId: job.id, referenceId: reference.id, durationSeconds, rms, peak, clippedSamples, generationSeconds: (Date.now() - started) / 1000 }
  report.takes.push(take)
  console.log(JSON.stringify(take))
}
await writeFile(path.join(root, '.runtime/voice-auditions/bilingual-flow-report.json'), JSON.stringify(report, null, 2))
