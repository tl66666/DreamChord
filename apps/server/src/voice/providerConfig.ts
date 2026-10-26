export type VoiceProviderConfig =
  | { enabled: true; provider: 'gpt-sovits'; baseUrl: string; timeoutMs: number }
  | { enabled: false; provider: 'none'; reason: string }

export function readVoiceProviderConfig(env: Record<string, string | undefined> = process.env): VoiceProviderConfig {
  const selectedProvider = env.VOICE_PROVIDER?.trim() || 'gpt-sovits'
  if (selectedProvider !== 'gpt-sovits') {
    return { enabled: false, provider: 'none', reason: '本机声音生成服务已停用，仍可使用声音库与手动上传。' }
  }

  const rawBaseUrl = env.GPT_SOVITS_BASE_URL || 'http://127.0.0.1:9880'
  let url: URL
  try {
    url = new URL(rawBaseUrl)
  } catch {
    return { enabled: false, provider: 'none', reason: 'GPT-SoVITS 地址格式无效。' }
  }

  const localHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
  if (!localHosts.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
    return { enabled: false, provider: 'none', reason: '第一版仅允许连接本机 GPT-SoVITS 服务。' }
  }

  const parsedTimeout = Number(env.GPT_SOVITS_TIMEOUT_MS || 120_000)
  const timeoutMs = Number.isFinite(parsedTimeout) ? Math.min(300_000, Math.max(5_000, parsedTimeout)) : 120_000
  return { enabled: true, provider: 'gpt-sovits', baseUrl: url.toString().replace(/\/$/, ''), timeoutMs }
}

