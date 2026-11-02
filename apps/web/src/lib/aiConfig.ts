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
    models: [],
    defaultModel: '',
    allowCustomModel: true,
    allowCustomBaseUrl: false,
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
  },
  {
    provider: 'glm',
    name: '智谱 GLM',
    url: 'https://open.bigmodel.cn',
    models: [],
    defaultModel: '',
    allowCustomModel: true,
    allowCustomBaseUrl: false,
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  {
    provider: 'deepseek',
    name: 'DeepSeek',
    url: 'https://platform.deepseek.com',
    models: [],
    defaultModel: '',
    allowCustomModel: true,
    allowCustomBaseUrl: false,
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  {
    provider: 'custom',
    name: '自定义 OpenAI 兼容接口',
    url: '',
    models: [],
    defaultModel: '',
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
      if (!Array.isArray(parsed)) throw new Error('Invalid settings')
      return PROVIDER_META.map((meta) => {
        const existing = parsed.find((config) => config.provider === meta.provider)
        return {
          provider: meta.provider,
          name: meta.name,
          enabled: existing?.enabled === true,
          apiKey: typeof existing?.apiKey === 'string' ? existing.apiKey.trim() : '',
          model: typeof existing?.model === 'string' ? existing.model.trim() : meta.defaultModel,
          baseUrl: typeof existing?.baseUrl === 'string' ? existing.baseUrl.trim() : meta.defaultBaseUrl ?? '',
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
  const error = validateAIConfigs(configs)
  if (error) throw new Error(error)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs.map((config) => ({ ...config, apiKey: config.apiKey.trim(), model: config.model.trim(), baseUrl: config.baseUrl?.trim() }))))
}

export function validateAIConfigs(configs: AIProviderConfig[]): string | undefined {
  if (configs.filter((config) => config.enabled).length > 1) return '请只启用一个模型提供商。'
  for (const config of configs.filter((item) => item.enabled)) {
    if (!config.apiKey.trim()) return `${config.name}：请填写 API Key。`
    if (!config.model.trim() || config.model.trim() === '自定义模型') return `${config.name}：请填写平台提供的模型 ID。`
    if (config.model.trim().length > 160) return '模型 ID 不能超过 160 个字符。'
    if (config.provider === 'custom' || config.baseUrl) {
      try {
        const url = new URL(config.baseUrl?.trim() || '')
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error()
      } catch { return `${config.name}：请填写有效的 HTTP(S) Base URL，不要包含密钥、查询参数或片段。` }
    }
  }
}

export function setActiveModel(provider: string, model: string): AIProviderConfig | null {
  const nextModel = model.trim()
  if (!nextModel) return getDefaultProvider()
  const configs = loadAIConfigs().map((config) => config.provider === provider ? { ...config, model: nextModel } : config)
  saveAIConfigs(configs)
  return configs.find((config) => config.enabled && !validateAIConfigs([config])) ?? null
}

export function getDefaultProvider(): AIProviderConfig | null {
  const configs = loadAIConfigs()
  return configs.find((config) => config.enabled && !validateAIConfigs([config])) || null
}

export function getAllEnabledProviders(): AIProviderConfig[] {
  return loadAIConfigs().filter((config) => config.enabled && !validateAIConfigs([config]))
}

export function resolveBaseUrl(provider: string, baseUrl?: string): string | undefined {
  const meta = PROVIDER_META.find((item) => item.provider === provider)
  if (provider === 'custom') return baseUrl
  return baseUrl || meta?.defaultBaseUrl
}
