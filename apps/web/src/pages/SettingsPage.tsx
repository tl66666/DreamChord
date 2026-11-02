import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Save, ExternalLink, Check, AlertCircle, ArrowLeft } from 'lucide-react'
import { loadAIConfigs, saveAIConfigs, validateAIConfigs, PROVIDER_META, type AIProviderConfig } from '../lib/aiConfig'
import AppHeader from '../components/AppHeader'
import StudioIntro from '../components/StudioIntro'

export default function SettingsPage() {
  const location = useLocation()
  const [configs, setConfigs] = useState<AIProviderConfig[]>([])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const requestedReturn = new URLSearchParams(location.search).get('returnTo')
  const returnTo = requestedReturn?.startsWith('/') && !requestedReturn.startsWith('//') ? requestedReturn : '/'
  const returnLabel = returnTo === '/' ? '返回首页' : returnTo.startsWith('/library') ? '返回素材库' : returnTo.startsWith('/editor') ? '返回编辑器' : '返回创作 Agent'

  useEffect(() => {
    const loaded = loadAIConfigs()
    setConfigs(loaded)

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
    setError('')
    setDirty(true)
  }

  const handleSave = () => {
    const validation = validateAIConfigs(configs)
    if (validation) { setError(validation); return }
    try {
      saveAIConfigs(configs)
      setSaved(true)
      setDirty(false)
      setError('')
    } catch { setError('无法保存配置，请检查浏览器是否允许本地存储后重试。') }
  }

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  return (
    <div className="dc-page">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Link
              to={returnTo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-dream-700 transition hover:bg-dream-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {returnLabel}
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">设置</h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-500">
            配置创作与翻译使用的模型。密钥保存在当前浏览器，调用时经本机服务转发给所选提供商。
          </p>
        </div>
        <button
          onClick={handleSave}
          className="dc-primary"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? '已保存' : '保存配置'}
        </button>
      </div>

      <StudioIntro className="mb-6" image="/assets/ui/writing-nook.webp" landscape><div><p className="text-xs font-semibold text-dream-600">创作设置</p><h2 className="mt-2 text-lg font-bold text-slate-950">让工具配合你的写作习惯</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">创作助手与日语配音翻译共用已启用的模型。未配置在线模型时，配音可使用本机翻译组件。</p></div></StudioIntro>
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-dream-200 bg-dream-50/50 p-4 text-sm text-dream-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-dream-500" />
        <p>填写服务平台实际提供的模型 ID，无需等待软件更新。保存后用于后续 Agent 任务和翻译，正在执行的任务继续使用原配置。</p>
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {dirty && <p role="status" className="mb-4 text-sm text-amber-700">配置尚未保存。</p>}
      <div className="space-y-6">
        {PROVIDER_META.map((meta) => {
          const cfg = configs.find((c) => c.provider === meta.provider)
          if (!cfg) return null
          return (
            <div
              key={meta.provider}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div><h2 className="text-lg font-semibold text-slate-950">{meta.name}</h2><p className={`mt-0.5 text-xs ${cfg.enabled && cfg.apiKey.trim() ? 'text-emerald-700' : 'text-slate-500'}`}>{cfg.enabled && cfg.apiKey.trim() ? dirty ? '待保存 · 配置完成后生效' : '已启用 · 配置保存在当前浏览器' : cfg.enabled ? '已启用 · 请填写 API Key' : '未启用'}</p></div>
                  {meta.url && (
                    <a
                      href={meta.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-dream-600 hover:text-dream-800"
                    >
                      申请 API Key <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <input
                    type="radio"
                    name="active-provider"
                    checked={cfg.enabled}
                    onChange={(e) => updateConfig(meta.provider, 'enabled', e.target.checked)}
                    className="h-4 w-4 border-dream-300 text-dream-600 focus:ring-dream-500"
                  />
                  <span className="whitespace-nowrap text-sm text-slate-700">{cfg.enabled ? '使用中' : '启用'}</span>
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor={`key-${meta.provider}`} className="mb-1.5 block text-sm font-medium text-slate-700">API Key</label>
                  <input
                    id={`key-${meta.provider}`}
                    type="password"
                    value={cfg.apiKey}
                    onChange={(e) => updateConfig(meta.provider, 'apiKey', e.target.value)}
                    placeholder={`输入 ${meta.name} API Key`}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
                  />
                </div>

                <div>
                  <label htmlFor={`model-${meta.provider}`} className="mb-1.5 block text-sm font-medium text-slate-700">模型 ID</label>
                  <input id={`model-${meta.provider}`} type="text" value={cfg.model} maxLength={160}
                    onChange={(event) => updateConfig(meta.provider, 'model', event.target.value)}
                    placeholder="从服务平台复制完整的模型 ID"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20" />
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">可填写新模型、私有模型或平台部署名；需要与当前 API Key、接口地址匹配。</p>
                </div>

                {meta.allowCustomBaseUrl && (
                  <div>
                    <label htmlFor={`base-${meta.provider}`} className="mb-1.5 block text-sm font-medium text-slate-700">自定义 Base URL</label>
                    <input
                      id={`base-${meta.provider}`}
                      type="text"
                      value={cfg.baseUrl || ''}
                      onChange={(e) => updateConfig(meta.provider, 'baseUrl', e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
                    />
                    <p className="mt-1 text-xs text-slate-500">OpenAI 兼容接口，需支持 /chat/completions</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="sticky bottom-3 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dream-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button type="button" onClick={() => { setConfigs((prev) => prev.map((config) => ({ ...config, enabled: false }))); setDirty(true); setSaved(false); setError('') }} className="text-sm font-medium text-slate-600 hover:text-dream-700">停用在线模型</button>
        <button type="button" onClick={handleSave} className="dc-primary">{saved ? '配置已保存' : '保存并生效'}</button>
      </div>
      </main>
    </div>
  )
}
