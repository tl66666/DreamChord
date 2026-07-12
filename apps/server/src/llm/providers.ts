import { requestProviderJson } from './providerTransport.js'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAICompatibleResponse {
  choices?: Array<{ message?: { content?: string } }>
}

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
  stream?: boolean
  signal?: AbortSignal
}

export interface LLMProviderConfig {
  apiKey: string
  baseUrl?: string
  model: string
}

export abstract class LLMProvider {
  constructor(protected config: LLMProviderConfig) {}

  abstract name: string
  abstract defaultBaseUrl: string

  protected get baseUrl() {
    return this.config.baseUrl || this.defaultBaseUrl
  }

  abstract chat(messages: LLMMessage[], options?: LLMOptions): Promise<string>

  protected async post(path: string, body: unknown, externalSignal?: AbortSignal): Promise<OpenAICompatibleResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)
    const abort = () => controller.abort()
    externalSignal?.addEventListener('abort', abort, { once: true })
    try {
      return await requestProviderJson<OpenAICompatibleResponse>(`${this.baseUrl}${path}`, body, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: controller.signal,
        errorPrefix: this.name,
      })
    } finally {
      clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', abort)
    }
  }
}

/**
 * 所有走 OpenAI 兼容 `/chat/completions` 协议的 Provider 的公共基类。
 * 子类只需覆盖 `name` 与 `defaultBaseUrl`（自定义接口还需覆盖 `requireExplicitBaseUrl`）。
 */
export abstract class BaseOpenAICompatibleProvider extends LLMProvider {
  /**
   * 是否强制要求调用方在 config 中显式提供 baseUrl。
   * 自定义 OpenAI 兼容接口（无默认地址）需要置为 true。
   */
  protected requireExplicitBaseUrl = false

  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    if (this.requireExplicitBaseUrl && !this.config.baseUrl) {
      throw new Error('自定义接口必须提供 baseUrl')
    }
    const data = await this.post('/chat/completions', {
      model: this.config.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    }, options.signal)
    return data.choices?.[0]?.message?.content || ''
  }
}

export class GLMProvider extends BaseOpenAICompatibleProvider {
  name = '智谱 GLM'
  defaultBaseUrl = 'https://open.bigmodel.cn/api/paas/v4'
}

export class DeepSeekProvider extends BaseOpenAICompatibleProvider {
  name = 'DeepSeek'
  defaultBaseUrl = 'https://api.deepseek.com'
}

export class KimiProvider extends BaseOpenAICompatibleProvider {
  name = 'Kimi'
  defaultBaseUrl = 'https://api.moonshot.cn/v1'
}

export class OpenAICompatibleProvider extends BaseOpenAICompatibleProvider {
  name = 'OpenAI Compatible'
  defaultBaseUrl = ''
  protected requireExplicitBaseUrl = true
}

export function createProvider(provider: string, config: LLMProviderConfig): LLMProvider {
  switch (provider.toLowerCase()) {
    case 'glm':
    case 'zhipu':
      return new GLMProvider(config)
    case 'deepseek':
      return new DeepSeekProvider(config)
    case 'kimi':
    case 'moonshot':
      return new KimiProvider(config)
    case 'custom':
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config)
    default:
      // 尝试作为 OpenAI 兼容接口使用，只要提供了 baseUrl
      if (config.baseUrl) {
        return new OpenAICompatibleProvider(config)
      }
      throw new Error(`不支持的 AI 提供商: ${provider}`)
  }
}
