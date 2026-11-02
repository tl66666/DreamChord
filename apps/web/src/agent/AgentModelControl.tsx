import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'

export default function AgentModelControl({ provider, disabled, onChange, onSettings }: {
  provider?: { name: string; model: string } | null; disabled: boolean
  onChange?: (model: string) => void; onSettings: () => void
}) {
  const [draft, setDraft] = useState(provider?.model ?? '')
  const [error, setError] = useState('')
  useEffect(() => { setDraft(provider?.model ?? ''); setError('') }, [provider?.model])
  const apply = () => {
    if (disabled || !draft.trim() || !onChange) return
    try { onChange(draft.trim()); setError('') } catch { setError('模型未保存，请检查浏览器存储后重试。') }
  }
  return <div aria-label="当前模型" className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2">
    <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate font-medium text-slate-600">{provider?.name ?? '本地创作模式'}</span>
      <button type="button" aria-label="模型设置" title="模型设置" disabled={disabled} onClick={onSettings} className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-500 hover:bg-white hover:text-slate-950 disabled:opacity-40"><Settings2 className="h-3.5 w-3.5" /></button>
    </div>
    {provider ? <div className="flex min-w-0 gap-1.5">
      <input aria-label="当前模型 ID" value={draft} maxLength={160} disabled={disabled} placeholder="填写平台提供的模型 ID" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); apply() } if (event.key === 'Escape') setDraft(provider.model) }} className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-dream-500" />
      <button type="button" aria-label="应用模型" disabled={disabled || !draft.trim() || draft.trim() === provider.model} onClick={apply} className="shrink-0 rounded-md border border-dream-200 bg-white px-2 text-xs font-medium text-dream-700 disabled:border-slate-200 disabled:text-slate-400">应用</button>
    </div> : <p className="text-[11px] leading-5 text-slate-500">可整理项目、检查结构；开放式续写请先配置模型。</p>}
    {draft.trim() !== provider?.model && provider && <p className="mt-1 text-[11px] text-amber-700">点击应用后用于后续任务。</p>}
    {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
  </div>
}
