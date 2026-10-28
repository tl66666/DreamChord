import type { VoiceProvider, VoiceProviderHealth, VoiceSynthesisInput, VoiceSynthesisResult } from './provider.js'

type Fetcher = typeof fetch

export class GptSovitsProvider implements VoiceProvider {
  readonly id = 'gpt-sovits'
  readonly capabilities = {
    voiceClone: true,
    instructionEmotion: false,
    emotionReference: true,
    speedControl: true,
  } as const

  constructor(
    private readonly config: { baseUrl: string; timeoutMs: number },
    private readonly fetcher: Fetcher = fetch,
  ) {}

  async health(): Promise<VoiceProviderHealth> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.min(this.config.timeoutMs, 5_000))
    try {
      const response = await this.fetcher(`${this.config.baseUrl}/`, { signal: controller.signal })
      return {
        ok: response.status < 500,
        provider: this.id,
        message: response.status < 500 ? 'GPT-SoVITS 服务可访问' : `GPT-SoVITS 服务异常（${response.status}）`,
      }
    } catch {
      return { ok: false, provider: this.id, message: '无法连接本机 GPT-SoVITS 服务' }
    } finally {
      clearTimeout(timeout)
    }
  }

  async synthesize(input: VoiceSynthesisInput): Promise<VoiceSynthesisResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
    try {
      const response = await this.fetcher(`${this.config.baseUrl}/tts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text: input.text,
          text_lang: normalizeLanguage(input.textLanguage),
          ref_audio_path: input.referencePath,
          prompt_text: input.promptText,
          prompt_lang: normalizeLanguage(input.promptLanguage),
          speed_factor: input.speed,
          seed: input.seed ?? -1,
          media_type: 'wav',
          streaming_mode: false,
        }),
      })
      if (!response.ok) throw new Error(`GPT-SoVITS 请求失败（${response.status}）`)
      const seedHeader = response.headers.get('x-seed')
      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        mimeType: response.headers.get('content-type')?.split(';')[0] || 'audio/wav',
        ...(seedHeader && Number.isFinite(Number(seedHeader)) ? { seed: Number(seedHeader) } : {}),
        providerMetadata: {
          directionMode: 'emotion-reference',
          requestedEmotion: input.direction?.emotion || 'neutral',
        },
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('GPT-SoVITS 生成超时')
      if (error instanceof Error && error.message.startsWith('GPT-SoVITS 请求失败')) throw error
      throw new Error('GPT-SoVITS 生成失败')
    } finally {
      clearTimeout(timeout)
    }
  }
}

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase().replace('_', '-')
  const primary = normalized.split('-')[0]
  if (primary === 'cn') return 'zh'
  if (primary === 'jp') return 'ja'
  return primary || 'zh'
}

