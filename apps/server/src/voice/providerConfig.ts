export type VoiceProviderConfig =
  | { enabled: true; provider: 'gpt-sovits'; baseUrl: string; timeoutMs: number }
  | { enabled: true; provider: 'cosyvoice'; baseUrl: string; timeoutMs: number; sampleRate: number }
  | { enabled: false; provider: 'none'; reason: string }

export function readVoiceProviderConfig(env: Record<string, string | undefined> = process.env): VoiceProviderConfig {
  const selectedProvider = env.VOICE_PROVIDER?.trim() || 'gpt-sovits'
  if (selectedProvider === 'none') {
    return { enabled: false, provider: 'none', reason: '本机声音生成服务已停用，仍可使用声音库与手动上传。' }
  }

  if (!['gpt-sovits', 'cosyvoice'].includes(selectedProvider)) {
    return { enabled: false, provider: 'none', reason: `不支持的声音引擎：${selectedProvider}` }
  }

  const cosyVoice = selectedProvider === 'cosyvoice'
  const rawBaseUrl = cosyVoice
    ? env.COSYVOICE_BASE_URL || 'http://127.0.0.1:50000'
    : env.GPT_SOVITS_BASE_URL || 'http://127.0.0.1:9880'
  let url: URL
  try {
    url = new URL(rawBaseUrl)
  } catch {
    return { enabled: false, provider: 'none', reason: `${cosyVoice ? 'CosyVoice' : 'GPT-SoVITS'} 地址格式无效。` }
  }

  const localHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
  if (!localHosts.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
    return { enabled: false, provider: 'none', reason: '为保护声音素材，声音引擎仅允许连接本机服务。' }
  }

  const timeoutFallback = cosyVoice ? 180_000 : 120_000
  const parsedTimeout = Number(cosyVoice ? env.COSYVOICE_TIMEOUT_MS || timeoutFallback : env.GPT_SOVITS_TIMEOUT_MS || timeoutFallback)
  const timeoutMs = Number.isFinite(parsedTimeout) ? Math.min(300_000, Math.max(5_000, parsedTimeout)) : timeoutFallback
  const baseUrl = url.toString().replace(/\/$/, '')
  if (!cosyVoice) return { enabled: true, provider: 'gpt-sovits', baseUrl, timeoutMs }

  const requestedSampleRate = Number(env.COSYVOICE_SAMPLE_RATE || 24_000)
  const supportedRates = new Set([22_050, 24_000, 44_100, 48_000])
  const sampleRate = supportedRates.has(requestedSampleRate) ? requestedSampleRate : 24_000
  return { enabled: true, provider: 'cosyvoice', baseUrl, timeoutMs, sampleRate }
}

