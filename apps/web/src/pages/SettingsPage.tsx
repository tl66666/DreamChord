import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Save, ExternalLink, Check, AlertCircle, ArrowLeft } from 'lucide-react'
import { loadAIConfigs, saveAIConfigs, PROVIDER_META, type AIProviderConfig } from '../lib/aiConfig'

export default function SettingsPage() {
  const [configs, setConfigs] = useState<AIProviderConfig[]>([])
  const [saved, setSaved] = useState(false)
  const [customModels, setCustomModels] = useState<Record<string, string>>({})

  useEffect(() => {
    const loaded = loadAIConfigs()
    setConfigs(loaded)
    const customs: Record<string, string> = {}
    loaded.forEach((c) => {
      const meta = PROVIDER_META.find((m) => m.provider === c.provider)
      if (meta?.allowCustomModel && !meta.models.includes(c.model)) {
        customs[c.provider] = c.model
      }
    })
    setCustomModels(customs)
  }, [])

  const updateConfig = (provider: string, field: keyof AIProviderConfig, value: string | boolean) => {
    setConfigs((prev) => {
      // 启用某个提供商时，自动禁用其他所有提供商（单选模式）
      if (field === 'enabled' && value === true) {
        return prev.map((cfg) => ({
          ...cfg,
          enabled: cfg.provider === provider,
        }))
      }
      return prev.map((cfg) => (cfg.provider === provider ? { ...cfg, [field]: value } : cfg))
    })
    setSaved(false)
  }

  const handleModelChange = (provider: string, value: string) => {
    if (value === '__custom__') {
      updateConfig(provider, 'model', customModels[provider] || '')
    } else {
      updateConfig(provider, 'model', value)
    }
  }

  const handleCustomModelChange = (provider: string, value: string) => {
    setCustomModels((prev) => ({ ...prev, [provider]: value }))
    const cfg = configs.find((c) => c.provider === provider)
    const meta = PROVIDER_META.find((m) => m.provider === provider)
    if (cfg && meta && !meta.models.includes(cfg.model)) {
      updateConfig(provider, 'model', value)
    }
  }

  const handleSave = () => {
    saveAIConfigs(configs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="container mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-dream-700 transition hover:bg-dream-50"
            >
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
            <h1 className="text-3xl font-bold text-dream-900">设置</h1>
          </div>
          <p className="text-dream-600">
            配置 AI 提供商 API Key。所有密钥仅保存在浏览器本地，不会上传到服务端。
          </p>
        </div>
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-full bg-dream-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-dream-500/30 transition hover:bg-dream-700"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? '已保存' : '保存配置'}
        </button>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-dream-200 bg-dream-50/50 p-4 text-sm text-dream-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-dream-500" />
        <p>同一时间只能启用一个 AI 提供商。启用新的提供商会自动停用当前的。切换后编辑器中的 AI 功能将立即使用新模型。</p>
      </div>

      <div className="space-y-6">
        {PROVIDER_META.map((meta) => {
          const cfg = configs.find((c) => c.provider === meta.provider)
          if (!cfg) return null
          const isCustomModel = meta.allowCustomModel && !meta.models.includes(cfg.model)
          return (
            <div
              key={meta.provider}
              className="rounded-2xl border border-dream-100 bg-white/70 p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-dream-900">{meta.name}</h2>
                  {meta.url && (
                    <a
                      href={meta.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-dream-500 hover:text-dream-700"
                    >
                      申请 API Key <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="active-provider"
                    checked={cfg.enabled}
                    onChange={(e) => updateConfig(meta.provider, 'enabled', e.target.checked)}
                    className="h-4 w-4 border-dream-300 text-dream-600 focus:ring-dream-500"
                  />
                  <span className="text-sm text-dream-700">{cfg.enabled ? '使用中' : '启用'}</span>
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-dream-700">API Key</label>
                  <input
                    type="password"
                    value={cfg.apiKey}
                    onChange={(e) => updateConfig(meta.provider, 'apiKey', e.target.value)}
                    placeholder={`输入 ${meta.name} API Key`}
                    className="w-full rounded-xl border border-dream-200 bg-white px-4 py-2 text-sm text-dream-900 placeholder:text-dream-400 focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-dream-700">默认模型</label>
                  <select
                    value={isCustomModel ? '__custom__' : cfg.model}
                    onChange={(e) => handleModelChange(meta.provider, e.target.value)}
                    className="w-full rounded-xl border border-dream-200 bg-white px-4 py-2 text-sm text-dream-900 focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
                  >
                    {meta.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                    {meta.allowCustomModel && <option value="__custom__">自定义模型...</option>}
                  </select>
                </div>

                {isCustomModel && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-dream-700">自定义模型名</label>
                    <input
                      type="text"
                      value={customModels[meta.provider] || cfg.model}
                      onChange={(e) => handleCustomModelChange(meta.provider, e.target.value)}
                      placeholder="例如：kimi-2-7-preview"
                      className="w-full rounded-xl border border-dream-200 bg-white px-4 py-2 text-sm text-dream-900 placeholder:text-dream-400 focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
                    />
                  </div>
                )}

                {meta.allowCustomBaseUrl && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-dream-700">自定义 Base URL</label>
                    <input
                      type="text"
                      value={cfg.baseUrl || ''}
                      onChange={(e) => updateConfig(meta.provider, 'baseUrl', e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="w-full rounded-xl border border-dream-200 bg-white px-4 py-2 text-sm text-dream-900 placeholder:text-dream-400 focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
                    />
                    <p className="mt-1 text-xs text-dream-500">OpenAI 兼容接口，需支持 /chat/completions</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
