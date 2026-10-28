import { readFile } from 'node:fs/promises'
import type { VoiceDirection } from '@dreamchord/story-domain'
import type { VoiceProvider, VoiceProviderHealth, VoiceSynthesisInput, VoiceSynthesisResult } from './provider.js'

type Fetcher = typeof fetch
type ReferenceReader = (path: string) => Promise<Buffer>

export class CosyVoiceProvider implements VoiceProvider {
  readonly id = 'cosyvoice'
  readonly capabilities = {
    voiceClone: true,
    instructionEmotion: true,
    emotionReference: false,
    speedControl: true,
  } as const

  constructor(
    private readonly config: { baseUrl: string; timeoutMs: number; sampleRate: number },
    private readonly fetcher: Fetcher = fetch,
    private readonly readReference: ReferenceReader = readFile,
  ) {}

  async health(): Promise<VoiceProviderHealth> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.min(this.config.timeoutMs, 5_000))
    try {
      const response = await this.fetcher(`${this.config.baseUrl}/health`, { signal: controller.signal })
      const status = response.ok ? await response.json() as { ok?: boolean; provider?: string } : null
      const ok = response.ok && status?.ok === true && status.provider === this.id
      return {
        ok,
        provider: this.id,
        message: ok ? 'CosyVoice 情感配音服务可访问' : `CosyVoice 服务未就绪（${response.status}）`,
      }
    } catch {
      return { ok: false, provider: this.id, message: '无法连接本机 CosyVoice 服务' }
    } finally {
      clearTimeout(timeout)
    }
  }

  async synthesize(input: VoiceSynthesisInput): Promise<VoiceSynthesisResult> {
    if (/^(ja|jp)(-|$)/i.test(input.textLanguage)) throw new Error('日文请使用本机 GPT-SoVITS 参考配音；当前 CosyVoice 指令模式未通过日文校验。')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
    const endpoint = input.direction ? 'inference_instruct2' : 'inference_zero_shot'
    try {
      const reference = await this.readReference(input.referencePath)
      const body = new FormData()
      body.set('tts_text', input.text)
      body.set('speed', String(input.speed))
      body.set('prompt_wav', new Blob([new Uint8Array(reference)], { type: 'audio/wav' }), 'reference.wav')
      if (input.direction) body.set('instruct_text', cosyVoiceInstruction(input.direction, input.speed, input.textLanguage))
      else body.set('prompt_text', input.promptText)

      const response = await this.fetcher(`${this.config.baseUrl}/${endpoint}`, {
        method: 'POST', body, signal: controller.signal,
      })
      if (!response.ok) throw new Error(`CosyVoice 请求失败（${response.status}）`)
      const raw = Buffer.from(await response.arrayBuffer())
      if (raw.length < 2 || raw.length % 2 !== 0) throw new Error('CosyVoice 返回的音频为空或已损坏')
      const reportedRate = Number(response.headers.get('x-audio-sample-rate'))
      const sampleRate = [22050, 24000, 44100, 48000].includes(reportedRate) ? reportedRate : this.config.sampleRate
      return {
        bytes: isWave(raw) ? raw : pcm16ToWave(raw, sampleRate),
        mimeType: 'audio/wav',
        providerMetadata: {
          directionMode: input.direction ? 'instruct2' : 'zero-shot',
          sampleRate,
          ...(input.direction ? { requestedEmotion: input.direction.emotion } : {}),
        },
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('CosyVoice 生成超时')
      if (error instanceof Error && error.message.startsWith('CosyVoice 请求失败')) throw error
      throw new Error('CosyVoice 生成失败')
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function cosyVoiceInstruction(direction: VoiceDirection, requestedSpeed = direction.pace, language = 'zh'): string {
  const emotions: Record<VoiceDirection['emotion'], string> = {
    neutral: '自然、生活化', warm: '温柔、有亲近感', joy: '带着真实的喜悦', sad: '悲伤但不过度哭腔',
    tense: '紧张、呼吸略急', angry: '愤怒但不要吼叫', afraid: '害怕且带一点迟疑', resolve: '坚定、有决心', whisper: '贴近耳语、气声克制',
  }
  const pace = requestedSpeed <= 0.96 ? '语速稍慢' : requestedSpeed >= 1.08 ? '语速稍快' : '语速自然'
  const pauses = direction.pauseProfile === 'dramatic'
    ? '关键语义前后有短暂停顿'
    : direction.pauseProfile === 'short' ? '停顿紧凑，不拖长尾音' : '停顿自然'
  const intensity = direction.intensity >= 0.72 ? '情绪较明显' : direction.intensity <= 0.35 ? '情绪克制' : '情绪适中'
  const languageHint = language.toLowerCase().startsWith('ja') ? '日本語で自然に話してください。' : language.toLowerCase().startsWith('en') ? 'Speak naturally in English. ' : '用自然的中文对白表达。'
  return `${languageHint}${direction.delivery || '自然对白'}；${emotions[direction.emotion]}；${intensity}；${pace}；${pauses}。像角色在当下真实说话，避免播音腔和夸张表演。`
}

function isWave(bytes: Buffer): boolean {
  return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE'
}

function pcm16ToWave(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}
