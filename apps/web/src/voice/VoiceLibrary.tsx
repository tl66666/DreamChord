import { useEffect, useMemo, useRef, useState } from 'react'
import { directVoiceLine, type VoiceEmotion } from '@dreamchord/story-domain'
import AudioWorkspaceHeader from '../library/AudioWorkspaceHeader'
import VoiceProfileEditor, { apiError } from './VoiceProfileEditor'
import { VOICE_BINDINGS_CHANGED } from './characterVoicePlan'
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
  unbindCharacterVoice,
  removeVoiceReference,
  translateVoiceText,
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

const emotionLabels: Record<VoiceEmotion, string> = {
  neutral: '自然', warm: '温柔', joy: '喜悦', sad: '悲伤', tense: '紧张',
  angry: '愤怒', afraid: '害怕', resolve: '坚定', whisper: '耳语',
}

export default function VoiceLibrary() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [health, setHealth] = useState<VoiceProviderHealth | null>(null)
  const [samples, setSamples] = useState<Asset[]>([])
  const [projects, setProjects] = useState<ProjectDetail[]>([])
  const [jobs, setJobs] = useState<VoiceGenerationJob[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [genderFilter, setGenderFilter] = useState('全部声线')
  const [ageFilter, setAgeFilter] = useState('全部年龄感')
  const [previewProfile, setPreviewProfile] = useState<VoiceProfile | null>(null)
  const [previewLocale, setPreviewLocale] = useState('zh')
  const [editingProfile, setEditingProfile] = useState<VoiceProfile | null>(null)
  const [languageFilter, setLanguageFilter] = useState('all')
  const [catalogFilter, setCatalogFilter] = useState('all')
  const [translating, setTranslating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [engineBusy, setEngineBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(emptyDraft)
  const [reference, setReference] = useState({ assetId: '', transcript: '', language: 'zh', emotion: '自然', consent: false })
  const [binding, setBinding] = useState({ projectId: '', characterId: '' })
  const [generation, setGeneration] = useState({ referenceId: '', text: '', language: 'zh', emotion: '自然', speed: 1 })
  const [automaticDirection, setAutomaticDirection] = useState(true)
  const [currentJob, setCurrentJob] = useState<VoiceGenerationJob | null>(null)
  const detailsRef = useRef<HTMLElement>(null)
  const openProfile = (profile: VoiceProfile) => {
    setSelectedId(profile.id)
    requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      detailsRef.current?.focus({ preventScroll: true })
    })
  }

  useEffect(() => {
    void Promise.all([getVoiceProfiles(), getVoiceProviderHealth(), getAssetLibrary(), getMyProjects(), getVoiceGenerationJobs()])
      .then(([nextProfiles, nextHealth, assets, nextProjects, nextJobs]) => {
        const castOrder = ['cast-voice-yuki', 'cast-voice-ren', 'cast-voice-miya', 'cast-voice-sora', 'cast-voice-ghost']
        const ranked = [...nextProfiles].sort((first, second) => (castOrder.includes(first.id) ? castOrder.indexOf(first.id) : 99) - (castOrder.includes(second.id) ? castOrder.indexOf(second.id) : 99))
        setProfiles(ranked)
        setSelectedId(ranked[0]?.id || '')
        setHealth(nextHealth)
        setSamples(assets.filter((asset) => asset.type === 'VOICE_SAMPLE'))
        setProjects(nextProjects)
        setJobs(nextJobs)
      })
      .catch(() => setError('声音库暂时无法加载，请确认已经登录并启动服务端。'))
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return profiles.filter((profile) => (!normalized || `${profile.name} ${profile.description} ${profile.tags}`.toLowerCase().includes(normalized))
      && (catalogFilter === 'all' || (catalogFilter === 'official' ? isStarterVoice(profile) : !isStarterVoice(profile)))
      && (languageFilter === 'all' || profile.language.split('-')[0] === languageFilter || profile.references.some((item) => item.language.split('-')[0] === languageFilter))
      && (genderFilter === '全部声线' || profile.genderTone === genderFilter)
      && (ageFilter === '全部年龄感' || profile.ageTone === ageFilter))
  }, [ageFilter, catalogFilter, genderFilter, languageFilter, profiles, query])
  const selected = filtered.find((profile) => profile.id === selectedId) || filtered[0]
  const selectedProfileId = selected?.id
  const selectedLanguage = selected?.language
  const selectedEmotion = selected?.defaultEmotion
  const selectedSpeed = selected?.defaultSpeed
  useEffect(() => {
    if (!selectedProfileId) return
    setGeneration((current) => ({ ...current, referenceId: '', language: selectedLanguage?.startsWith('ja') ? 'ja' : 'zh', emotion: selectedEmotion || '自然', speed: selectedSpeed || 1 }))
    setReference((current) => ({ ...current, assetId: '', language: selectedLanguage?.split('-')[0] || 'zh' }))
  }, [selectedProfileId, selectedLanguage, selectedEmotion, selectedSpeed])
  const selectedProject = projects.find((project) => project.id === binding.projectId)
  const characterName = selectedProject?.characters.find((character) => character.id === binding.characterId)?.name || '雪'
  const directedLine = useMemo(() => directVoiceLine({ role: characterName, text: generation.text }), [characterName, generation.text])
  const engineName = health?.provider === 'cosyvoice' ? 'CosyVoice 情感配音' : health?.provider === 'gpt-sovits' ? 'GPT-SoVITS' : '声音引擎'
  const chosenReferenceId = selected?.references.some((item) => item.id === generation.referenceId) ? generation.referenceId : selected?.references.find((item) => item.language.startsWith(generation.language))?.id || selected?.references[0]?.id || ''
  const hasCurrentBinding = Boolean(selected?.bindings.some((item) => item.character.id === binding.characterId && item.project.id === binding.projectId))
  const previewCandidate = previewProfile && !previewProfile.previewUrl ? jobs.find((job) => job.profile?.id === previewProfile.id && job.language.startsWith(previewLocale) && job.status === 'completed' && job.outputUrl) : undefined
  const previewReference = previewProfile?.references.find((item) => item.language.startsWith(previewLocale))
  const previewUrl = previewCandidate?.outputUrl || previewReference?.asset.url || previewProfile?.previewUrl || previewProfile?.references[0]?.asset.url
  const refreshProfile = (profile: VoiceProfile) => {
    setProfiles((current) => current.map((item) => item.id === profile.id ? profile : item))
    if (previewProfile?.id === profile.id) setPreviewProfile(profile)
  }
  const unbind = async (id: string) => {
    try {
      await unbindCharacterVoice(id)
      setProfiles((current) => current.map((profile) => ({ ...profile, bindings: profile.bindings.filter((item) => item.id !== id) })))
      window.dispatchEvent(new Event(VOICE_BINDINGS_CHANGED))
    } catch (cause) { setError(apiError(cause, '解除绑定失败，请重试。')) }
  }
  const removeReference = async (referenceId: string) => {
    if (!selected) return
    try {
      await removeVoiceReference(selected.id, referenceId)
      refreshProfile({ ...selected, references: selected.references.filter((item) => item.id !== referenceId) })
    } catch (cause) { setError(apiError(cause, '该参考片段已有配音记录，不能移除。')) }
  }

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
      setProfiles((current) => current.map((profile) => ({ ...profile, bindings: [
        ...profile.bindings.filter((item) => item.character.id !== created.character.id),
        ...(profile.id === selected.id ? [created] : []),
      ] })))
      window.dispatchEvent(new Event(VOICE_BINDINGS_CHANGED))
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
      setTranslating(generation.language === 'ja')
      const sourceText = generation.text.trim()
      const spokenText = generation.language === 'ja' ? (await translateVoiceText(sourceText)).text : sourceText
      setTranslating(false)
      const created = await createVoiceGeneration({
        projectId: binding.projectId, characterId: binding.characterId, referenceId: chosenReferenceId,
        text: spokenText, language: generation.language, sourceText, sourceLanguage: 'zh', emotion: generation.emotion, speed: generation.speed,
        directionMode: automaticDirection ? 'auto' : 'manual',
      })
      setCurrentJob(created)
      setJobs((current) => [created, ...current.filter((item) => item.id !== created.id)])
      if (created.status === 'queued' || created.status === 'running') void pollGeneration(created.id).catch(() => setError('生成状态读取失败，可稍后回到声音库查看。'))
    } catch (cause) { setError(apiError(cause, '无法开始生成，请检查翻译组件、声音引擎和角色绑定。')) } finally { setSubmitting(false); setTranslating(false) }
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
      setHealth((current) => ({ ...current, ok: false, provider: current?.provider || 'none', message: engine.message, engine }))
      void refreshEngineUntilReady().catch(() => setError('声音引擎状态检查失败，请稍后刷新。'))
    } catch { setError('内置声音引擎无法启动，请先按安装向导完成一次性安装。') } finally { setEngineBusy(false) }
  }

  const stopEngine = async () => {
    if (engineBusy) return
    setEngineBusy(true); setError('')
    try {
      const engine = await stopVoiceEngine()
      setHealth((current) => ({ ...current, ok: false, provider: current?.provider || 'none', message: engine.message, engine }))
    } catch { setError('声音引擎停止失败。') } finally { setEngineBusy(false) }
  }

  return (
    <div>
      <AudioWorkspaceHeader kind="voice" count={profiles.length} action={<button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-white"><Plus className="h-4 w-4" />创建角色音色</button>} />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-950">声音库</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">集中管理私有音色、授权参考片段和项目角色绑定。生成的对白必须试听确认后才进入正式配音素材。</p></div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700"><Plus className="h-4 w-4" />新建音色</button>
      </div>

      <div className={`mb-5 flex flex-wrap items-start gap-3 rounded-lg border p-4 ${health?.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        {health?.ok ? <Wifi className="mt-0.5 h-5 w-5 shrink-0" /> : <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />}
        <div className="min-w-[170px] flex-1"><p className="text-sm font-semibold">{health?.ok ? `内置 ${engineName} 已可用` : health?.engine?.state === 'starting' ? '正在加载声音模型' : '当前仅使用声音资产管理'}</p><p className="mt-1 text-xs leading-5">{health?.engine?.message || health?.message || '正在检查声音服务…'}；手动上传配音仍可使用。</p>{health?.capabilities && <p className="mt-1 text-xs leading-5">{health.capabilities.instructionEmotion ? '支持按台词情绪调整表演、语速与停顿' : '支持按台词调整语速；情绪表现主要取决于所选参考片段'}</p>}</div>
        {health?.engine?.installed && !health.ok && <button disabled={engineBusy || health.engine.state === 'starting'} onClick={() => void startEngine()} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"><Play className="h-3.5 w-3.5" />启动内置声音引擎</button>}
        {health?.engine?.canManage && health.ok && <button disabled={engineBusy} onClick={() => void stopEngine()} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 disabled:opacity-50"><Square className="h-3.5 w-3.5" />停止引擎</button>}
      </div>
      {error && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div role="group" aria-label="音色分类" className="mb-3 flex flex-wrap gap-2">{[['all', '全部音色'], ['official', '梦弦音色'], ['custom', '我的音色']].map(([value, label]) => <button key={value} aria-pressed={catalogFilter === value} onClick={() => setCatalogFilter(value)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${catalogFilter === value ? 'bg-dream-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-dream-50'}`}>{label}</button>)}</div>
      <div role="group" aria-label="音色语言筛选" className="mb-3 flex flex-wrap gap-2">{[['all', '全部样音语言'], ['zh', '中文样音'], ['ja', '日语样音']].map(([value, label]) => <button key={value} aria-pressed={languageFilter === value} onClick={() => setLanguageFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs ${languageFilter === value ? 'border-dream-200 bg-dream-50 text-dream-700' : 'border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}</div>

      <div role="group" aria-label="音色筛选" className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-[minmax(220px,1.5fr)_1fr_1fr]">
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">搜索音色</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、标签、适用剧情" className="h-10 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500" /></label>
        <select aria-label="性别声线" value={genderFilter} onChange={(event) => setGenderFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option>全部声线</option><option>女声</option><option>男声</option><option>中性</option></select>
        <select aria-label="年龄感" value={ageFilter} onChange={(event) => setAgeFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option>全部年龄感</option><option>少女</option><option>少年</option><option>青年</option><option>成熟</option></select>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((profile, index) => {
          const tags = voiceTags(profile)
          const canPreview = Boolean(profile.previewUrl || profile.references[0]?.asset.url || jobs.some((job) => job.profile?.id === profile.id && job.status === 'completed' && job.outputUrl))
          return <article key={profile.id} className={`rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${selected?.id === profile.id ? 'border-violet-300 shadow-md shadow-violet-100' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${index % 3 === 0 ? 'from-fuchsia-200 to-violet-500' : index % 3 === 1 ? 'from-cyan-200 to-blue-500' : 'from-amber-200 to-rose-500'} text-lg font-black text-white ring-4 ring-white shadow`}>{profile.name.slice(0, 1)}</div>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-bold text-slate-950">{profile.name}</h3><span className={`h-2 w-2 shrink-0 rounded-full ${profile.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} /></div><p className="mt-1 text-xs text-slate-500">{profile.genderTone || '未设声线'} · {profile.ageTone || '未设年龄感'} · {profile.language}</p></div>
              <button type="button" aria-label={`试听${profile.name}`} disabled={!canPreview} onClick={() => setPreviewProfile(profile)} className="rounded-full bg-slate-950 p-2.5 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200"><Play className="h-4 w-4 fill-current" /></button>
            </div>
            <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{profile.description || '暂无音色说明'}</p>
            <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">{tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">{tag}</span>)}{isStarterVoice(profile) && <span className="rounded-full border border-cyan-100 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">梦弦合成音</span>}</div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-[11px] text-slate-400">{profile.references.length} 条参考 · {profile.bindings.length} 个角色</span><button onClick={() => openProfile(profile)} className="min-h-10 text-xs font-semibold text-violet-700 hover:text-violet-900">查看与使用</button></div>
          </article>
        })}
        {!filtered.length && <div className="md:col-span-2 2xl:col-span-3 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">没有符合条件的音色，换个筛选条件试试。</div>}
      </div>

      <div className="mt-6 min-h-[560px]">
        <section ref={detailsRef} tabIndex={-1} aria-label="当前音色配置" className="scroll-mt-24 rounded-2xl border border-slate-200 p-5 outline-none">
          {selected ? <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div><div className="flex flex-wrap items-center gap-2"><Mic2 className="h-5 w-5 text-dream-600" /><h3 className="text-xl font-bold text-slate-950">{selected.name}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isStarterVoice(selected) ? 'border border-cyan-200 bg-cyan-50 text-cyan-800' : 'bg-slate-100 text-slate-600'}`}>{isStarterVoice(selected) ? '梦弦内置 · 合成音' : '私有'}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{selected.description || '为这个音色补充年龄感、情绪范围和适用角色，会更容易稳定复用。'}</p></div>
              <div className="flex items-center gap-2"><span title="当前生成引擎" className="rounded-full bg-dream-50 px-3 py-1 text-xs font-medium text-dream-700">{engineName}</span><button onClick={() => setEditingProfile(selected)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">编辑与配置</button></div>
            </div>
            {isStarterVoice(selected) && <div className="mt-4 flex items-start gap-3 rounded-xl border border-cyan-200 bg-cyan-50/70 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" /><div><p className="text-sm font-semibold text-cyan-950">来源清晰的合成起始音色</p><p className="mt-1 text-xs leading-5 text-cyan-900">{selected.authorizationNote}</p></div></div>}
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><Info label="语言" value={selected.language} /><Info label="默认情绪" value={selected.defaultEmotion} /><Info label="默认语速" value={`${selected.defaultSpeed.toFixed(2)}×`} /></div>
            {selected.status !== 'active' && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">此音色已停用。参考片段和历史配音仍保留，恢复后可继续生成。</p>}
            {selected.bindings.length > 0 && <div className="mt-4 rounded-xl border border-slate-200 p-3"><p className="mb-2 text-xs font-semibold text-slate-500">正在使用此音色的角色</p>{selected.bindings.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{item.project.title} · {item.character.name}</span><button onClick={() => void unbind(item.id)} className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600">解除绑定</button></div>)}</div>}
            <div className="mt-6"><h4 className="font-semibold text-slate-900">授权参考片段</h4><p className="mt-1 text-xs leading-5 text-slate-500">推荐 3–15 秒单人干声，并填写与录音逐字一致的原文。</p>
              <div className="mt-3 space-y-2">{selected.references.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-900">{item.asset.name}</span><span className="text-xs text-emerald-700">已授权</span></div><audio controls preload="metadata" className="mt-2 h-9 w-full" src={item.asset.url}>你的浏览器不支持音频预览。</audio><p className="mt-2 text-xs leading-5 text-slate-600">“{item.transcript}” · {item.language} · {item.emotion}</p><button onClick={() => void removeReference(item.id)} className="mt-2 text-xs text-slate-500 hover:text-rose-600">从此音色解除参考片段</button></div>)}</div>
            </div>
            <div className="mt-6 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4">
              <div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 text-violet-600" /><div><h4 className="font-semibold text-slate-900">角色绑定与试听生成</h4><p className="mt-1 text-xs leading-5 text-slate-500">三步完成：选择角色 → 绑定音色 → 写一句台词试听。满意后再收入正式配音素材库。</p></div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-700">选择项目<select aria-label="选择项目" value={binding.projectId} onChange={(event) => setBinding({ projectId: event.target.value, characterId: '' })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">请选择项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
                <label className="text-xs font-medium text-slate-700">选择角色<select aria-label="选择角色" value={binding.characterId} onChange={(event) => setBinding((old) => ({ ...old, characterId: event.target.value }))} disabled={!selectedProject} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"><option value="">请选择角色</option>{selectedProject?.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
              </div>
              <button disabled={selected.status !== 'active' || !binding.projectId || !binding.characterId || hasCurrentBinding || submitting} onClick={() => void submitBinding()} className="mt-3 inline-flex items-center gap-2 rounded-md border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-violet-700 disabled:opacity-50"><Link2 className="h-4 w-4" />{hasCurrentBinding ? '角色已绑定当前音色' : '绑定这个音色'}</button>

              <div className="mt-4 border-t border-violet-100 pt-4">
                <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-violet-900"><input type="checkbox" checked={automaticDirection} onChange={(event) => setAutomaticDirection(event.target.checked)} className="accent-violet-600" />自动适配台词情绪与节奏</label>
                {automaticDirection && generation.text.trim() && <div role="status" aria-label="台词表演建议" className="mb-4 rounded-lg border border-violet-200 bg-white p-3"><p className="text-sm font-semibold text-violet-900">{emotionLabels[directedLine.emotion]} · {directedLine.pace.toFixed(2)}× · {directedLine.pauseProfile === 'dramatic' ? '关键处留白' : directedLine.pauseProfile === 'short' ? '短句紧凑' : '自然停顿'}</p><p className="mt-1 text-xs leading-5 text-slate-600">{directedLine.delivery}</p><p className="mt-1 text-xs text-slate-400">建议随台词变化；关闭自动适配可手动指定。</p></div>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-700">参考片段<select value={chosenReferenceId} onChange={(event) => setGeneration((old) => ({ ...old, referenceId: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">请选择参考片段</option>{selected.references.map((item) => <option key={item.id} value={item.id}>{item.asset.name} · {item.emotion}</option>)}</select></label>
                  <label className="text-xs font-medium text-slate-700">表达情绪<select aria-label="表达情绪" disabled={automaticDirection} value={automaticDirection ? emotionLabels[directedLine.emotion] : generation.emotion} onChange={(event) => setGeneration((old) => ({ ...old, emotion: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100">{Object.values(emotionLabels).map((emotion) => <option key={emotion}>{emotion}</option>)}</select></label>
                  <label className="sm:col-span-2 text-xs font-medium text-slate-700">中文台词<textarea aria-label="试听台词" value={generation.text} onChange={(event) => setGeneration((old) => ({ ...old, text: event.target.value }))} rows={3} maxLength={2000} placeholder="输入中文即可，例如：我们把这一刻写下来吧。" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><span className="mt-1 block font-normal leading-5 text-slate-500">选择日语配音后会自动翻译，中文字幕保留原文。</span></label>
                  <label className="text-xs font-medium text-slate-700">语速 {(automaticDirection ? directedLine.pace : generation.speed).toFixed(2)}×<input aria-label="配音语速" disabled={automaticDirection} type="range" min="0.75" max="1.2" step="0.01" value={automaticDirection ? directedLine.pace : generation.speed} onChange={(event) => setGeneration((old) => ({ ...old, speed: Number(event.target.value) }))} className="mt-2 w-full accent-violet-600" /></label>
                  <label className="text-xs font-medium text-slate-700">配音语言<select aria-label="配音语言" value={generation.language} onChange={(event) => setGeneration((old) => ({ ...old, language: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="zh">中文配音</option><option value="ja">日语配音 · 自动翻译</option></select></label>
                  <button aria-label="生成试听" disabled={selected.status !== 'active' || !health?.ok || !hasCurrentBinding || !chosenReferenceId || !generation.text.trim() || submitting} onClick={() => void submitGeneration()} className="self-end rounded-lg bg-dream-600 px-4 py-2 text-sm font-semibold text-white hover:bg-dream-700 disabled:cursor-not-allowed disabled:opacity-40">{translating ? '正在翻译…' : submitting ? '正在提交…' : '生成试听'}</button>
                </div>
                {!health?.ok && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">声音引擎尚未连接。你可以先完成音色和角色绑定，启动声音引擎后再生成。</p>}
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

      {previewProfile && previewUrl && <div data-testid="voice-player-tray" className="sticky bottom-4 z-20 mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white shadow-2xl shadow-slate-400/40">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-300 to-violet-600 font-black">{previewProfile.name.slice(0, 1)}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{previewProfile.name}</p><p className="text-xs text-slate-400">{previewCandidate ? `对白候选 · ${previewCandidate.text}` : `参考声音 · ${previewReference?.asset.name || '默认试听'}`}</p></div>
        {previewProfile.references.some((item) => item.language.startsWith('ja')) && <select aria-label="试听语言" value={previewLocale} onChange={(event) => setPreviewLocale(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs"><option value="zh">中文</option><option value="ja">日本語</option></select>}
        <audio key={previewUrl} aria-label="音色持续播放器" controls autoPlay preload="metadata" src={previewUrl} className="h-10 w-full max-w-xl md:w-[420px]">你的浏览器不支持音频预览。</audio><button aria-label="关闭音色播放器" onClick={() => setPreviewProfile(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
      </div>}

      {creating && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-label="新建音色" className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h3 className="text-lg font-bold text-slate-950">新建私有音色</h3><p className="mt-1 text-sm text-slate-500">先建立档案，再登记一个或多个授权参考片段。</p></div><button onClick={() => setCreating(false)} aria-label="关闭"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="音色名称" value={draft.name} onChange={(value) => setDraft((old) => ({ ...old, name: value }))} /><label className="text-sm font-medium text-slate-700">主要语言<select value={draft.language} onChange={(event) => setDraft((old) => ({ ...old, language: event.target.value }))} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="zh">中文</option><option value="ja">日语</option><option value="en">英语</option></select></label><Field label="年龄感" value={draft.ageTone} onChange={(value) => setDraft((old) => ({ ...old, ageTone: value }))} placeholder="例如：青年、成熟" /><Field label="声音标签" value={draft.tags} onChange={(value) => setDraft((old) => ({ ...old, tags: value }))} placeholder="温柔，清亮，近距离" /><label className="sm:col-span-2 text-sm font-medium text-slate-700">说明<textarea value={draft.description} onChange={(event) => setDraft((old) => ({ ...old, description: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2" /></label><label className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><input aria-label="我确认拥有本人同意或合法授权" type="checkbox" checked={draft.consent} onChange={(event) => setDraft((old) => ({ ...old, consent: event.target.checked }))} className="mt-1" /><span>我确认声音来自本人，或已获得声音所有者明确、可撤销的合法授权；不会用于冒充、欺骗或未经同意的克隆。</span></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setCreating(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm">取消</button><button disabled={!draft.name.trim() || !draft.consent || submitting} onClick={() => void submitProfile()} className="rounded-md bg-dream-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">创建私有音色</button></div></section></div>}
      {editingProfile && <VoiceProfileEditor key={editingProfile.id} profile={editingProfile} onSaved={refreshProfile} onDeleted={(id) => { setProfiles((current) => current.filter((item) => item.id !== id)); if (previewProfile?.id === id) setPreviewProfile(null) }} onClose={() => setEditingProfile(null)} />}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-medium text-slate-800">{value}</p></div> }
function Field({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="text-sm font-medium text-slate-700">{label}<input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2" /></label> }

function isStarterVoice(profile: VoiceProfile) {
  return profile.id.startsWith('starter-voice-profile-dreamchord-') || profile.id.startsWith('cast-voice-')
}

function voiceTags(profile: VoiceProfile): string[] {
  try {
    const parsed = JSON.parse(profile.tags)
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : []
  } catch { return [] }
}

