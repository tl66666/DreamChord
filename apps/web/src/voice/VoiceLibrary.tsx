import { useEffect, useMemo, useState } from 'react'
import { Headphones, Mic2, Plus, Search, ShieldCheck, Wifi, WifiOff, X } from 'lucide-react'
import {
  attachVoiceReference,
  createVoiceProfile,
  getAssetLibrary,
  getVoiceProfiles,
  getVoiceProviderHealth,
  type Asset,
  type VoiceProfile,
  type VoiceProviderHealth,
} from '../api/client'

const emptyDraft = {
  name: '', description: '', language: 'zh', ageTone: '', genderTone: '', tags: '',
  defaultEmotion: '自然', defaultSpeed: 1, authorizationNote: '本人录制或已获得声音所有者的明确授权', consent: false,
}

export default function VoiceLibrary() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [health, setHealth] = useState<VoiceProviderHealth | null>(null)
  const [samples, setSamples] = useState<Asset[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(emptyDraft)
  const [reference, setReference] = useState({ assetId: '', transcript: '', language: 'zh', emotion: '自然', consent: false })

  useEffect(() => {
    void Promise.all([getVoiceProfiles(), getVoiceProviderHealth(), getAssetLibrary()])
      .then(([nextProfiles, nextHealth, assets]) => {
        setProfiles(nextProfiles)
        setSelectedId(nextProfiles[0]?.id || '')
        setHealth(nextHealth)
        setSamples(assets.filter((asset) => asset.type === 'VOICE_SAMPLE'))
      })
      .catch(() => setError('声音库暂时无法加载，请确认已经登录并启动服务端。'))
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return profiles
    return profiles.filter((profile) => `${profile.name} ${profile.description} ${profile.tags}`.toLowerCase().includes(normalized))
  }, [profiles, query])
  const selected = profiles.find((profile) => profile.id === selectedId) || filtered[0]

  const submitProfile = async () => {
    if (!draft.name.trim() || !draft.consent || submitting) return
    setSubmitting(true); setError('')
    try {
      const created = await createVoiceProfile({
        name: draft.name.trim(), description: draft.description.trim(), language: draft.language,
        ageTone: draft.ageTone.trim(), genderTone: draft.genderTone.trim(),
        tags: draft.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        defaultEmotion: draft.defaultEmotion.trim() || '自然', defaultSpeed: draft.defaultSpeed,
        authorizationConfirmed: true, authorizationNote: draft.authorizationNote.trim(),
      })
      setProfiles((current) => [created, ...current]); setSelectedId(created.id); setCreating(false); setDraft(emptyDraft)
    } catch { setError('音色创建失败，请检查必填项和授权说明。') } finally { setSubmitting(false) }
  }

  const submitReference = async () => {
    if (!selected || !reference.assetId || !reference.transcript.trim() || !reference.consent || submitting) return
    setSubmitting(true); setError('')
    try {
      const created = await attachVoiceReference(selected.id, {
        assetId: reference.assetId, transcript: reference.transcript.trim(), language: reference.language,
        emotion: reference.emotion.trim() || '自然', authorizationConfirmed: true,
      })
      setProfiles((current) => current.map((profile) => profile.id === selected.id ? { ...profile, references: [created, ...profile.references] } : profile))
      setReference({ assetId: '', transcript: '', language: selected.language, emotion: '自然', consent: false })
    } catch { setError('参考片段登记失败；同一声音样本不能重复绑定。') } finally { setSubmitting(false) }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-950">声音库</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">集中管理私有音色、授权参考片段和项目角色绑定。生成的对白必须试听确认后才进入正式配音素材。</p></div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700"><Plus className="h-4 w-4" />新建音色</button>
      </div>

      <div className={`mb-5 flex items-start gap-3 rounded-lg border p-4 ${health?.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        {health?.ok ? <Wifi className="mt-0.5 h-5 w-5 shrink-0" /> : <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />}
        <div><p className="text-sm font-semibold">{health?.ok ? 'GPT-SoVITS 已连接' : '当前仅使用声音资产管理'}</p><p className="mt-1 text-xs leading-5">{health?.message || '正在检查声音服务…'}；手动上传配音仍可使用。</p></div>
      </div>
      {error && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[310px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">搜索音色</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、标签、说明" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" /></label>
          <div className="mt-3 space-y-2">
            {filtered.map((profile) => (
              <button key={profile.id} onClick={() => setSelectedId(profile.id)} className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === profile.id ? 'border-dream-300 bg-white shadow-sm' : 'border-transparent hover:bg-white'}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{profile.name}</span><span className={`h-2 w-2 rounded-full ${profile.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} /></div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{profile.description || '暂无说明'}</p>
                <p className="mt-2 text-[11px] text-slate-400">{profile.language} · {profile.references.length} 条参考 · {profile.bindings.length} 个角色</p>
              </button>
            ))}
            {!filtered.length && <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">还没有音色档案</div>}
          </div>
        </aside>

        <section className="rounded-xl border border-slate-200 p-5">
          {selected ? <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div><div className="flex items-center gap-2"><Mic2 className="h-5 w-5 text-dream-600" /><h3 className="text-xl font-bold text-slate-950">{selected.name}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">私有</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{selected.description || '为这个音色补充年龄感、情绪范围和适用角色，会更容易稳定复用。'}</p></div>
              <span className="rounded-full bg-dream-50 px-3 py-1 text-xs font-medium text-dream-700">{selected.provider}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><Info label="语言" value={selected.language} /><Info label="默认情绪" value={selected.defaultEmotion} /><Info label="默认语速" value={`${selected.defaultSpeed.toFixed(2)}×`} /></div>
            <div className="mt-6"><h4 className="font-semibold text-slate-900">授权参考片段</h4><p className="mt-1 text-xs leading-5 text-slate-500">推荐 3–15 秒单人干声，并填写与录音逐字一致的原文。</p>
              <div className="mt-3 space-y-2">{selected.references.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-900">{item.asset.name}</span><span className="text-xs text-emerald-700">已授权</span></div><audio controls preload="metadata" className="mt-2 h-9 w-full" src={item.asset.url}>你的浏览器不支持音频预览。</audio><p className="mt-2 text-xs leading-5 text-slate-600">“{item.transcript}” · {item.language} · {item.emotion}</p></div>)}</div>
            </div>
            <div className="mt-6 rounded-lg border border-dream-100 bg-dream-50/50 p-4"><h4 className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-dream-600" />登记已有声音样本</h4>
              {samples.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-slate-700">声音样本<select value={reference.assetId} onChange={(event) => setReference((old) => ({ ...old, assetId: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">选择 VOICE_SAMPLE</option>{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.name}</option>)}</select></label><label className="text-xs font-medium text-slate-700">语言<select value={reference.language} onChange={(event) => setReference((old) => ({ ...old, language: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><option value="zh">中文</option><option value="ja">日语</option><option value="en">英语</option></select></label><label className="sm:col-span-2 text-xs font-medium text-slate-700">录音原文<textarea value={reference.transcript} onChange={(event) => setReference((old) => ({ ...old, transcript: event.target.value }))} rows={2} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="sm:col-span-2 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={reference.consent} onChange={(event) => setReference((old) => ({ ...old, consent: event.target.checked }))} className="mt-0.5" />再次确认该片段可用于声音生成</label><button disabled={!reference.assetId || !reference.transcript.trim() || !reference.consent || submitting} onClick={() => void submitReference()} className="sm:col-span-2 rounded-md bg-dream-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">登记参考片段</button></div> : <p className="mt-3 text-sm text-slate-500">请先在项目编辑器的“声线样本”中上传带原文和授权的录音。</p>}
            </div>
          </> : <div className="flex h-full min-h-[420px] items-center justify-center text-center text-slate-400"><div><Headphones className="mx-auto mb-3 h-10 w-10" /><p>创建第一个私有音色，开始积累可复用的角色声音。</p></div></div>}
        </section>
      </div>

      {creating && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-label="新建音色" className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h3 className="text-lg font-bold text-slate-950">新建私有音色</h3><p className="mt-1 text-sm text-slate-500">先建立档案，再登记一个或多个授权参考片段。</p></div><button onClick={() => setCreating(false)} aria-label="关闭"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="音色名称" value={draft.name} onChange={(value) => setDraft((old) => ({ ...old, name: value }))} /><label className="text-sm font-medium text-slate-700">主要语言<select value={draft.language} onChange={(event) => setDraft((old) => ({ ...old, language: event.target.value }))} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="zh">中文</option><option value="ja">日语</option><option value="en">英语</option></select></label><Field label="年龄感" value={draft.ageTone} onChange={(value) => setDraft((old) => ({ ...old, ageTone: value }))} placeholder="例如：青年、成熟" /><Field label="声音标签" value={draft.tags} onChange={(value) => setDraft((old) => ({ ...old, tags: value }))} placeholder="温柔，清亮，近距离" /><label className="sm:col-span-2 text-sm font-medium text-slate-700">说明<textarea value={draft.description} onChange={(event) => setDraft((old) => ({ ...old, description: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2" /></label><label className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><input aria-label="我确认拥有本人同意或合法授权" type="checkbox" checked={draft.consent} onChange={(event) => setDraft((old) => ({ ...old, consent: event.target.checked }))} className="mt-1" /><span>我确认声音来自本人，或已获得声音所有者明确、可撤销的合法授权；不会用于冒充、欺骗或未经同意的克隆。</span></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setCreating(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm">取消</button><button disabled={!draft.name.trim() || !draft.consent || submitting} onClick={() => void submitProfile()} className="rounded-md bg-dream-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">创建私有音色</button></div></section></div>}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-medium text-slate-800">{value}</p></div> }
function Field({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="text-sm font-medium text-slate-700">{label}<input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2" /></label> }

