export interface AIProviderConfig {
  provider: string
  name: string
  enabled: boolean
  apiKey: string
  model: string
  baseUrl?: string
}

export interface ProviderMeta {
  provider: string
  name: string
  url: string
  models: string[]
  defaultModel: string
  allowCustomModel: boolean
  allowCustomBaseUrl: boolean
  defaultBaseUrl?: string
}

export const PROVIDER_META: ProviderMeta[] = [
  {
    provider: 'kimi',
    name: 'Kimi (Moonshot)',
    url: 'https://platform.moonshot.cn',
    models: ['kimi-2-6', 'kimi-2-7', 'kimi-latest'],
    defaultModel: 'kimi-2-7',
    allowCustomModel: true,
    allowCustomBaseUrl: false,
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
  },
  {
    provider: 'glm',
    name: '智谱 GLM',
    url: 'https://open.bigmodel.cn',
    models: ['glm-4.7-flash', 'glm-5.1', 'glm-5.2', 'glm-4-flash', 'glm-4'],
    defaultModel: 'glm-5.2',
    allowCustomModel: true,
    allowCustomBaseUrl: false,
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  {
    provider: 'deepseek',
    name: 'DeepSeek',
    url: 'https://platform.deepseek.com',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-coder'],
    defaultModel: 'deepseek-v4-pro',
    allowCustomModel: true,
    allowCustomBaseUrl: false,
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  {
    provider: 'custom',
    name: '自定义 OpenAI 兼容接口',
    url: '',
    models: ['自定义模型'],
    defaultModel: '自定义模型',
    allowCustomModel: true,
    allowCustomBaseUrl: true,
  },
]

const STORAGE_KEY = 'dreamchord_ai_configs_v2'

export function loadAIConfigs(): AIProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AIProviderConfig[]
      return PROVIDER_META.map((meta) => {
        const existing = parsed.find((config) => config.provider === meta.provider)
        return {
          provider: meta.provider,
          name: meta.name,
          enabled: existing?.enabled ?? false,
          apiKey: existing?.apiKey ?? '',
          model: existing?.model || meta.defaultModel,
          baseUrl: existing?.baseUrl ?? meta.defaultBaseUrl ?? '',
        }
      })
    }
  } catch {
    // Keep the app usable even if local storage is malformed.
  }

  return PROVIDER_META.map((meta) => ({
    provider: meta.provider,
    name: meta.name,
    enabled: false,
    apiKey: '',
    model: meta.defaultModel,
    baseUrl: meta.defaultBaseUrl ?? '',
  }))
}

export function saveAIConfigs(configs: AIProviderConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
}

export function getDefaultProvider(): AIProviderConfig | null {
  const configs = loadAIConfigs()
  return configs.find((config) => config.enabled && config.apiKey) || null
}

export function getAllEnabledProviders(): AIProviderConfig[] {
  return loadAIConfigs().filter((config) => config.enabled && config.apiKey)
}

export function resolveBaseUrl(provider: string, baseUrl?: string): string | undefined {
  const meta = PROVIDER_META.find((item) => item.provider === provider)
  if (provider === 'custom') return baseUrl
  return baseUrl || meta?.defaultBaseUrl
}
