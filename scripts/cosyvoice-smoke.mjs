import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CosyVoiceProvider } from '../apps/server/dist/voice/cosyVoiceProvider.js'
import { directVoiceLine } from '../packages/story-domain/dist/index.js'
import { cosyVoiceRuntimeConfig } from './cosyvoice-runtime-config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeArgument = process.argv.indexOf('--runtime-root')
const config = cosyVoiceRuntimeConfig(runtimeArgument >= 0 ? { runtimeRoot: process.argv[runtimeArgument + 1] } : {})
const baseUrl = `http://${config.host}:${config.port}`
const outputRoot = path.join(root, '.runtime', 'voice-auditions')
const manifest = JSON.parse(await readFile(path.join(root, 'assets/voice-packs/dreamchord-starter/manifest.json'), 'utf8'))
const lines = [
  { voiceId: 'dreamchord-xingli', role: '雪', text: '这一次，我不会再把你删掉。' },
  { voiceId: 'dreamchord-muchuan', role: '影', text: '别碰那一页。上面还有我的名字。' },
  { voiceId: 'dreamchord-wulan', role: '宫', text: '没关系，先坐下来。我们还有时间。' },
]
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
let child
let engineLog = ''
let report

async function health() {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2500) })
    return response.ok ? await response.json() : null
  } catch { return null }
}

try {
  let status = await health()
  if (!status) {
    child = spawn(path.win32.join(config.environment, 'python.exe'), [config.bridge], {
      cwd: config.repository, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    })
    child.on('error', (error) => { engineLog += error.message })
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => { engineLog = (engineLog + data.toString()).slice(-6000) })
    const deadline = Date.now() + 180_000
    while (!status && Date.now() < deadline && child.exitCode === null) {
      await delay(1500)
      status = await health()
    }
    if (!status) throw new Error(`CosyVoice 未成功启动。${engineLog}`)
  }
  console.log(`CosyVoice 已就绪：CUDA=${status.cuda}, ${status.sampleRate}Hz`)
  const provider = new CosyVoiceProvider({ baseUrl, timeoutMs: 180_000, sampleRate: status.sampleRate })
  await mkdir(outputRoot, { recursive: true })
  report = { generatedAt: new Date().toISOString(), model: config.modelId, health: status, takes: [] }
  for (const line of process.argv.includes('--all') ? lines : lines.slice(0, 1)) {
    const reference = manifest.voices.find((voice) => voice.id === line.voiceId)
    if (!reference) throw new Error(`缺少参考音色 ${line.voiceId}`)
    const direction = directVoiceLine({ role: line.role, text: line.text })
    const started = performance.now()
    const result = await provider.synthesize({
      text: line.text, textLanguage: 'zh', promptLanguage: reference.language,
      promptText: reference.transcript,
      referencePath: path.join(root, 'assets/voice-packs/dreamchord-starter', reference.outputFile),
      speed: direction.pace, direction,
    })
    const sampleRate = result.bytes.readUInt32LE(24)
    const sampleCount = (result.bytes.length - 44) / 2
    let peak = 0, squareSum = 0, clipping = 0
    for (let offset = 44; offset < result.bytes.length; offset += 2) {
      const sample = result.bytes.readInt16LE(offset) / 32768
      peak = Math.max(peak, Math.abs(sample)); squareSum += sample * sample
      if (Math.abs(sample) >= 0.999) clipping++
    }
    const durationSeconds = sampleCount / sampleRate
    const rms = Math.sqrt(squareSum / sampleCount)
    if (durationSeconds < 0.5 || durationSeconds > 45 || rms < 0.001 || clipping / sampleCount > 0.01) {
      throw new Error(`音频技术检查失败：${durationSeconds.toFixed(2)}s, RMS=${rms}, clipping=${clipping}`)
    }
    const output = path.join(outputRoot, `${line.voiceId}-cosyvoice.wav`)
    await writeFile(output, result.bytes)
    const take = {
      ...line, direction, output: path.relative(root, output).replaceAll('\\', '/'),
      durationSeconds, generationSeconds: (performance.now() - started) / 1000,
      peak, rms, clippedSamples: clipping, expressiveReview: 'pending',
      sourceModel: manifest.sourceModel, sourceVoiceId: reference.sourceVoiceId,
    }
    report.takes.push(take)
    console.log(`${line.role}：${durationSeconds.toFixed(2)} 秒，生成耗时 ${take.generationSeconds.toFixed(2)} 秒。${output}`)
  }
  report.health = await health() || report.health
  await writeFile(path.join(outputRoot, 'cosyvoice-smoke-report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log('技术检查通过。声音表演仍需试听确认。')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  if (engineLog) console.error(engineLog)
  process.exitCode = 1
} finally {
  if (child) child.kill()
}
