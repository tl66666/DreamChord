import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Headphones, Link2, Loader2, Mic2, Play, Plus, Search, ShieldCheck, Sparkles, Square, Wifi, WifiOff, X } from 'lucide-react'
import {
  acceptVoiceGeneration,
  attachVoiceReference,
  bindCharacterVoice,
  createVoiceGeneration,
  createVoiceProfile,
  getAssetLibrary,
  getMyProjects,
  getVoiceGenerationJob,
  getVoiceGenerationJobs,
  getVoiceProfiles,
  getVoiceProviderHealth,
  startVoiceEngine,
  stopVoiceEngine,
  type Asset,
  type ProjectDetail,
  type VoiceGenerationJob,
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
  const [projects, setProjects] = useState<ProjectDetail[]>([])
  const [jobs, setJobs] = useState<VoiceGenerationJob[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [engineBusy, setEngineBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(emptyDraft)
  const [reference, setReference] = useState({ assetId: '', transcript: '', language: 'zh', emotion: '自然', consent: false })
  const [binding, setBinding] = useState({ projectId: '', characterId: '' })
  const [generation, setGeneration] = useState({ referenceId: '', text: '', language: 'zh', emotion: '自然', speed: 1 })
  const [currentJob, setCurrentJob] = useState<VoiceGenerationJob | null>(null)

  useEffect(() => {
    void Promise.all([getVoiceProfiles(), getVoiceProviderHealth(), getAssetLibrary(), getMyProjects(), getVoiceGenerationJobs()])
      .then(([nextProfiles, nextHealth, assets, nextProjects, nextJobs]) => {
        setProfiles(nextProfiles)
        setSelectedId(nextProfiles[0]?.id || '')
        setHealth(nextHealth)
        setSamples(assets.filter((asset) => asset.type === 'VOICE_SAMPLE'))
        setProjects(nextProjects)
        setJobs(nextJobs)
      })
      .catch(() => setError('声音库暂时无法加载，请确认已经登录并启动服务端。'))
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return profiles
    return profiles.filter((profile) => `${profile.name} ${profile.description} ${profile.tags}`.toLowerCase().includes(normalized))
  }, [profiles, query])
  const selected = profiles.find((profile) => profile.id === selectedId) || filtered[0]
  const selectedProject = projects.find((project) => project.id === binding.projectId)
  const chosenReferenceId = generation.referenceId || selected?.references[0]?.id || ''
  const hasCurrentBinding = Boolean(selected?.bindings.some((item) => item.character.id === binding.characterId && item.project.id === binding.projectId))

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

  const submitBinding = async () => {
    if (!selected || !binding.projectId || !binding.characterId || submitting) return
    setSubmitting(true); setError('')
    try {
      const created = await bindCharacterVoice(selected.id, binding)
      setProfiles((current) => current.map((profile) => profile.id === selected.id
        ? { ...profile, bindings: [...profile.bindings.filter((item) => item.character.id !== created.character.id), created] }
        : profile))
    } catch { setError('角色绑定失败，请确认项目和角色归你所有。') } finally { setSubmitting(false) }
  }

  const pollGeneration = async (jobId: string) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
      const next = await getVoiceGenerationJob(jobId)
      setCurrentJob(next)
      setJobs((current) => [next, ...current.filter((item) => item.id !== next.id)])
      if (next.status === 'completed' || next.status === 'failed') return
    }
    setError('生成仍在进行，可稍后回到声音库查看。')
  }

  const submitGeneration = async () => {
    if (!binding.projectId || !binding.characterId || !chosenReferenceId || !generation.text.trim() || submitting) return
    setSubmitting(true); setError('')
    try {
      const created = await createVoiceGeneration({
        projectId: binding.projectId, characterId: binding.characterId, referenceId: chosenReferenceId,
        text: generation.text.trim(), language: generation.language, emotion: generation.emotion, speed: generation.speed,
      })
      setCurrentJob(created)
      setJobs((current) => [created, ...current.filter((item) => item.id !== created.id)])
      if (created.status === 'queued' || created.status === 'running') void pollGeneration(created.id).catch(() => setError('生成状态读取失败，可稍后回到声音库查看。'))
    } catch { setError('无法开始生成，请检查 GPT-SoVITS 是否已启动、角色是否已绑定。') } finally { setSubmitting(false) }
  }

  const acceptCandidate = async () => {
    if (!currentJob || currentJob.status !== 'completed' || currentJob.acceptedAsset || submitting) return
    setSubmitting(true); setError('')
    const characterName = currentJob.character?.name || selectedProject?.characters.find((item) => item.id === binding.characterId)?.name || '角色'
    try {
      const asset = await acceptVoiceGeneration(currentJob.id, { name: `${characterName}-${currentJob.text.slice(0, 18)}` })
      const accepted = { ...currentJob, acceptedAsset: asset }
      setCurrentJob(accepted)
      setJobs((current) => current.map((item) => item.id === accepted.id ? accepted : item))
    } catch { setError('收入素材库失败，请稍后重试。') } finally { setSubmitting(false) }
  }

  const refreshEngineUntilReady = async () => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000))
      const next = await getVoiceProviderHealth()
      setHealth(next)
      if (next.ok || next.engine?.state === 'failed' || next.engine?.state === 'stopped') return
    }
  }

  const startEngine = async () => {
    if (engineBusy) return
    setEngineBusy(true); setError('')
    try {
      const engine = await startVoiceEngine()
      setHealth((current) => ({ ...current, ok: false, provider: 'gpt-sovits', message: engine.message, engine }))
      void refreshEngineUntilReady().catch(() => setError('声音引擎状态检查失败，请稍后刷新。'))
    } catch { setError('内置声音引擎无法启动，请先按安装向导完成一次性安装。') } finally { setEngineBusy(false) }
  }

  const stopEngine = async () => {
    if (engineBusy) return
    setEngineBusy(true); setError('')
    try {
      const engine = await stopVoiceEngine()
      setHealth((current) => ({ ...current, ok: false, provider: 'gpt-sovits', message: engine.message, engine }))
    } catch { setError('声音引擎停止失败。') } finally { setEngineBusy(false) }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-950">声音库</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">集中管理私有音色、授权参考片段和项目角色绑定。生成的对白必须试听确认后才进入正式配音素材。</p></div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700"><Plus className="h-4 w-4" />新建音色</button>
      </div>

      <div className={`mb-5 flex items-start gap-3 rounded-lg border p-4 ${health?.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        {health?.ok ? <Wifi className="mt-0.5 h-5 w-5 shrink-0" /> : <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />}
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{health?.ok ? '内置 GPT-SoVITS 已可用' : health?.engine?.state === 'starting' ? '正在加载声音模型' : '当前仅使用声音资产管理'}</p><p className="mt-1 text-xs leading-5">{health?.engine?.message || health?.message || '正在检查声音服务…'}；手动上传配音仍可使用。</p></div>
        {health?.engine?.installed && !health.ok && <button disabled={engineBusy || health.engine.state === 'starting'} onClick={() => void startEngine()} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"><Play className="h-3.5 w-3.5" />启动内置声音引擎</button>}
        {health?.engine?.canManage && health.ok && <button disabled={engineBusy} onClick={() => void stopEngine()} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 disabled:opacity-50"><Square className="h-3.5 w-3.5" />停止引擎</button>}
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
            <div className="mt-6 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4">
              <div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 text-violet-600" /><div><h4 className="font-semibold text-slate-900">角色绑定与试听生成</h4><p className="mt-1 text-xs leading-5 text-slate-500">三步完成：选择角色 → 绑定音色 → 写一句台词试听。满意后再收入正式配音素材库。</p></div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-700">选择项目<select aria-label="选择项目" value={binding.projectId} onChange={(event) => setBinding({ projectId: event.target.value, characterId: '' })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">请选择项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
                <label className="text-xs font-medium text-slate-700">选择角色<select aria-label="选择角色" value={binding.characterId} onChange={(event) => setBinding((old) => ({ ...old, characterId: event.target.value }))} disabled={!selectedProject} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"><option value="">请选择角色</option>{selectedProject?.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
              </div>
              <button disabled={!binding.projectId || !binding.characterId || hasCurrentBinding || submitting} onClick={() => void submitBinding()} className="mt-3 inline-flex items-center gap-2 rounded-md border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-violet-700 disabled:opacity-50"><Link2 className="h-4 w-4" />{hasCurrentBinding ? '角色已绑定当前音色' : '绑定这个音色'}</button>

              <div className="mt-4 border-t border-violet-100 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-700">参考片段<select value={chosenReferenceId} onChange={(event) => setGeneration((old) => ({ ...old, referenceId: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">请选择参考片段</option>{selected.references.map((item) => <option key={item.id} value={item.id}>{item.asset.name} · {item.emotion}</option>)}</select></label>
                  <label className="text-xs font-medium text-slate-700">表达情绪<input value={generation.emotion} onChange={(event) => setGeneration((old) => ({ ...old, emotion: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                  <label className="sm:col-span-2 text-xs font-medium text-slate-700">试听台词<textarea aria-label="试听台词" value={generation.text} onChange={(event) => setGeneration((old) => ({ ...old, text: event.target.value }))} rows={3} maxLength={5000} placeholder="例如：我们把这一刻写下来吧。" className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                  <label className="text-xs font-medium text-slate-700">语速 {generation.speed.toFixed(2)}×<input type="range" min="0.5" max="1.5" step="0.05" value={generation.speed} onChange={(event) => setGeneration((old) => ({ ...old, speed: Number(event.target.value) }))} className="mt-2 w-full accent-violet-600" /></label>
                  <button disabled={!health?.ok || !hasCurrentBinding || !chosenReferenceId || !generation.text.trim() || submitting} onClick={() => void submitGeneration()} className="self-end rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">生成试听</button>
                </div>
                {!health?.ok && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">GPT-SoVITS 尚未连接。你可以先完成音色和角色绑定，启动本机声音服务后再生成。</p>}
                {currentJob && <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{currentJob.status === 'completed' ? '试听候选已完成' : currentJob.status === 'failed' ? '这次生成失败' : '正在排队生成试听'}</p>{currentJob.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : currentJob.status !== 'failed' ? <Loader2 className="h-5 w-5 animate-spin text-violet-500" /> : null}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{currentJob.text}</p>
                  {currentJob.outputUrl && <audio aria-label="生成的配音试听" controls preload="metadata" className="mt-3 h-10 w-full" src={currentJob.outputUrl}>你的浏览器不支持音频预览。</audio>}
                  {currentJob.errorMessage && <p className="mt-2 text-xs text-rose-600">{currentJob.errorMessage}</p>}
                  {currentJob.status === 'completed' && <button disabled={Boolean(currentJob.acceptedAsset) || submitting} onClick={() => void acceptCandidate()} className="mt-3 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{currentJob.acceptedAsset ? '已收入配音素材库' : '收入配音素材库'}</button>}
                </div>}
                {jobs.filter((job) => job.profile?.id === selected.id && job.id !== currentJob?.id).slice(0, 3).length > 0 && <div className="mt-4"><p className="text-xs font-semibold text-slate-600">最近生成</p><div className="mt-2 space-y-2">{jobs.filter((job) => job.profile?.id === selected.id && job.id !== currentJob?.id).slice(0, 3).map((job) => <button key={job.id} onClick={() => setCurrentJob(job)} className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs"><span className="truncate pr-3">{job.character?.name || '角色'} · {job.text}</span><span className="shrink-0 text-slate-400">{job.status === 'completed' ? '可试听' : job.status === 'failed' ? '失败' : '生成中'}</span></button>)}</div></div>}
              </div>
            </div>
            <div className="mt-6 rounded-lg border border-dream-100 bg-dream-50/50 p-4"><h4 className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-dream-600" />登记已有声音样本</h4>
              {samples.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-slate-700">声音样本<select value={reference.assetId} onChange={(event) => setReference((old) => ({ ...old, assetId: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">选择 VOICE_SAMPLE</option>{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.name}</option>)}</select></label><label className="text-xs font-medium text-slate-700">语言<select value={reference.language} onChange={(event) => setReference((old) => ({ ...old, language: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><option value="zh">中文</option><option value="ja">日语</option><option value="en">英语</option></select></label><label className="sm:col-span-2 text-xs font-medium text-slate-700">录音原文<textarea value={reference.transcript} onChange={(event) => setReference((old) => ({ ...old, transcript: event.target.value }))} rows={2} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="sm:col-span-2 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={reference.consent} onChange={(event) => setReference((old) => ({ ...old, consent: event.target.checked }))} className="mt-0.5" />再次确认该片段可用于声音生成</label><button disabled={!reference.assetId || !reference.transcript.trim() || !reference.consent || submitting} onClick={() => void submitReference()} className="sm:col-span-2 rounded-md bg-dream-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">登记参考片段</button></div> : <p className="mt-3 text-sm text-slate-500">请先在项目编辑器的“声线样本”中上传带原文和授权的录音。</p>}
            </div>
          </> : <div className="flex h-full min-h-[420px] items-center justify-center px-5"><div className="w-full max-w-lg text-center"><Headphones className="mx-auto mb-3 h-10 w-10 text-violet-400" /><h3 className="text-lg font-bold text-slate-900">建立你的第一个角色声音</h3><p className="mt-2 text-sm leading-6 text-slate-500">不需要先训练模型。准备一段授权的清晰录音，按下面的顺序就能生成试听。</p><div className="mt-5 grid gap-2 text-left sm:grid-cols-3">{['上传 3–15 秒声线样本', '创建音色并绑定角色', '生成试听，满意后入库'].map((step, index) => <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{index + 1}</span><p className="mt-2 text-xs leading-5 text-slate-600">{step}</p></div>)}</div>{health?.engine?.state === 'not-installed' && <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left"><p className="text-xs font-semibold text-amber-900">首次使用先在项目根目录执行一次</p><code className="mt-2 block rounded bg-slate-950 px-3 py-2 text-xs text-violet-200">pnpm voice:setup</code><p className="mt-2 text-xs leading-5 text-amber-800">安装完成后只启动 DreamChord 即可，不需要另开 GPT-SoVITS。</p></div>}<button onClick={() => setCreating(true)} className="mt-5 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white">创建第一个音色</button></div></div>}
        </section>
      </div>

      {creating && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-label="新建音色" className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h3 className="text-lg font-bold text-slate-950">新建私有音色</h3><p className="mt-1 text-sm text-slate-500">先建立档案，再登记一个或多个授权参考片段。</p></div><button onClick={() => setCreating(false)} aria-label="关闭"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="音色名称" value={draft.name} onChange={(value) => setDraft((old) => ({ ...old, name: value }))} /><label className="text-sm font-medium text-slate-700">主要语言<select value={draft.language} onChange={(event) => setDraft((old) => ({ ...old, language: event.target.value }))} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="zh">中文</option><option value="ja">日语</option><option value="en">英语</option></select></label><Field label="年龄感" value={draft.ageTone} onChange={(value) => setDraft((old) => ({ ...old, ageTone: value }))} placeholder="例如：青年、成熟" /><Field label="声音标签" value={draft.tags} onChange={(value) => setDraft((old) => ({ ...old, tags: value }))} placeholder="温柔，清亮，近距离" /><label className="sm:col-span-2 text-sm font-medium text-slate-700">说明<textarea value={draft.description} onChange={(event) => setDraft((old) => ({ ...old, description: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2" /></label><label className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><input aria-label="我确认拥有本人同意或合法授权" type="checkbox" checked={draft.consent} onChange={(event) => setDraft((old) => ({ ...old, consent: event.target.checked }))} className="mt-1" /><span>我确认声音来自本人，或已获得声音所有者明确、可撤销的合法授权；不会用于冒充、欺骗或未经同意的克隆。</span></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setCreating(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm">取消</button><button disabled={!draft.name.trim() || !draft.consent || submitting} onClick={() => void submitProfile()} className="rounded-md bg-dream-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">创建私有音色</button></div></section></div>}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-medium text-slate-800">{value}</p></div> }
function Field({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="text-sm font-medium text-slate-700">{label}<input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2" /></label> }

