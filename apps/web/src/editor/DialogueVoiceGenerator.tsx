import { useEffect, useRef, useState } from 'react'
import { readLocalizationFields, voiceTextHash, type StoryLocale } from '@dreamchord/story-domain'
import { acceptVoiceGeneration, createVoiceGeneration, getVoiceGenerationJob, getVoiceProfiles, translateVoiceText, type VoiceGenerationJob, type VoiceProfile } from '../api/client'
import { resolveCharacterName } from '../engine/characters'
import { useEditorStore } from '../stores/editorStore'
import { apiError } from '../voice/VoiceProfileEditor'
import { projectVoiceLocale, VOICE_BINDINGS_CHANGED, VOICE_PREFERENCE_CHANGED } from '../voice/characterVoicePlan'

export default function DialogueVoiceGenerator({ nodeId, data, onUpdate }: { nodeId: string; data: Record<string, unknown>; onUpdate: (patch: Record<string, unknown>) => void }) {
  const projectId = useEditorStore((state) => state.project?.id)
  const chapterId = useEditorStore((state) => state.chapterId)
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [locale, setLocale] = useState<StoryLocale>(() => projectVoiceLocale(projectId))
  const [job, setJob] = useState<VoiceGenerationJob | null>(null)
  const [candidate, setCandidate] = useState({ role: '', sourceHash: '', originalJa: '', profileId: '' })
  const [manualTranslation, setManualTranslation] = useState<{ text: string; sourceHash: string } | null>(null)
  const [phase, setPhase] = useState<'idle' | 'translating' | 'generating' | 'applying'>('idle')
  const [error, setError] = useState('')
  const alive = useRef(true)
  const latest = useRef({ data, onUpdate })
  latest.current = { data, onUpdate }
  useEffect(() => {
    alive.current = true
    const load = () => { void getVoiceProfiles().then((items) => { if (alive.current) setProfiles(items) }).catch(() => { if (alive.current) setError('无法读取角色音色。') }) }
    load()
    window.addEventListener(VOICE_BINDINGS_CHANGED, load)
    return () => { alive.current = false; window.removeEventListener(VOICE_BINDINGS_CHANGED, load) }
  }, [])
  useEffect(() => {
    const updateLocale = () => setLocale(projectVoiceLocale(projectId))
    updateLocale()
    window.addEventListener(VOICE_PREFERENCE_CHANGED, updateLocale)
    return () => window.removeEventListener(VOICE_PREFERENCE_CHANGED, updateLocale)
  }, [projectId])
  const busy = phase !== 'idle'
  const role = String(data.role || '')
  const sourceText = String(data.text || '')
  const sourceHash = voiceTextHash(sourceText)
  const fields = readLocalizationFields(data)
  const japanese = fields.localizations?.ja
  const profile = profiles.find((item) => item.status === 'active' && item.bindings.some((binding) => binding.project.id === projectId && (binding.character.id === role || binding.character.name === role || binding.character.name === resolveCharacterName(role))))
  const binding = profile?.bindings.find((item) => item.project.id === projectId && [role, resolveCharacterName(role)].includes(item.character.name)) || profile?.bindings.find((item) => item.project.id === projectId && item.character.id === role)
  const reference = profile?.references.find((item) => item.status === 'active' && item.language.startsWith(locale)) || profile?.references.find((item) => item.status === 'active')
  const manual = manualTranslation?.sourceHash === sourceHash ? manualTranslation.text : ''
  const translationUnchanged = (japanese?.text || '') === candidate.originalJa || japanese?.text === job?.text
  const candidateMatches = Boolean(job && candidate.role === role && candidate.profileId === profile?.id && candidate.sourceHash === sourceHash && job.language === locale && (locale !== 'ja' || ((!manual || manual === job.text) && translationUnchanged)))

  const generate = async () => {
    if (!projectId || !binding || !reference || !sourceText.trim()) return
    setPhase(locale === 'ja' ? 'translating' : 'generating'); setError(''); setJob(null)
    setCandidate({ role, sourceHash, originalJa: japanese?.text || '', profileId: profile?.id || '' })
    try {
      let spoken = sourceText
      if (locale === 'ja') {
        const currentTranslation = japanese?.text && (!japanese.sourceHash || japanese.sourceHash === sourceHash) ? japanese.text : ''
        spoken = manual || currentTranslation || (await translateVoiceText(sourceText)).text
      }
      if (!alive.current) return
      if (voiceTextHash(String(latest.current.data.text || '')) !== sourceHash || String(latest.current.data.role || '') !== role) throw new Error('原文或角色已修改，请按新内容重新生成。')
      setPhase('generating')
      let next = await createVoiceGeneration({ projectId, characterId: binding.character.id, ...(chapterId ? { chapterId } : {}), nodeId, referenceId: reference.id, text: spoken, language: locale, sourceText, sourceLanguage: 'zh', directionMode: 'auto' })
      if (alive.current) setJob(next)
      const deadline = Date.now() + 240000
      while (['queued', 'running'].includes(next.status) && alive.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        if (!alive.current) return
        next = await getVoiceGenerationJob(next.id)
        if (alive.current) setJob(next)
      }
      if (next.status === 'failed') throw new Error(next.errorMessage || '配音生成失败。')
      if (['queued', 'running'].includes(next.status)) setError('任务仍在继续，可在声音库的最近生成中查看。')
    } catch (cause) { if (alive.current) setError(apiError(cause, cause instanceof Error ? cause.message : '生成失败，请在声音库检查引擎。')) }
    finally { if (alive.current) setPhase('idle') }
  }
  const apply = async () => {
    if (!job || !candidateMatches || busy) return
    setPhase('applying'); setError('')
    try {
      const asset = job.acceptedAsset || await acceptVoiceGeneration(job.id, { name: `${resolveCharacterName(role)} · ${locale === 'zh' ? '中文' : '日本語'} · ${sourceText.slice(0, 14)}` })
      if (!alive.current) return
      const currentFields = readLocalizationFields(latest.current.data)
      setJob({ ...job, acceptedAsset: asset })
      if (String(latest.current.data.role || '') !== candidate.role || voiceTextHash(String(latest.current.data.text || '')) !== candidate.sourceHash) { setError('原文或角色已修改，候选已入库，没有应用到当前台词。'); return }
      if (locale === 'ja' && (currentFields.localizations?.ja?.text || '') !== candidate.originalJa && currentFields.localizations?.ja?.text !== job.text) { setError('译文已修改，候选已入库，没有覆盖你的新译文。'); return }
      latest.current.onUpdate({ ...(locale === 'ja' ? { localizations: { ...currentFields.localizations, ja: { ...currentFields.localizations?.ja, text: job.text, sourceHash: candidate.sourceHash } } } : {}), voiceTracks: { ...currentFields.voiceTracks, [locale]: { url: asset.url, textHash: voiceTextHash(job.text), profileId: candidate.profileId } } })
    } catch (cause) { if (alive.current) setError(apiError(cause, '配音应用失败，请重试。')) }
    finally { if (alive.current) setPhase('idle') }
  }
  return <section className="rounded-xl border border-dream-200 bg-dream-50/50 p-4 text-xs" aria-label="台词配音">
    <p className="font-semibold text-slate-950">为这句台词配音</p>
    <p className="mt-1 leading-5 text-slate-600">{profile ? `使用 ${profile.name}，后续台词沿用同一音色。` : '先点顶部“角色配音”为角色绑定音色。'}本句可单独重录；批量生成请使用“角色配音”。中文台词保持不变。</p>
    <div className="mt-3 flex flex-wrap gap-2"><select aria-label="生成配音语言" disabled={busy} value={locale} onChange={(event) => { setLocale(event.target.value as StoryLocale); setManualTranslation(null) }} className="min-h-10 min-w-0 flex-1 rounded-lg border border-dream-200 bg-white px-3"><option value="zh">中文配音</option><option value="ja">日语配音 · 自动翻译</option></select><button aria-label="生成试听" disabled={busy || !binding || !reference || !sourceText.trim()} onClick={() => void generate()} className="min-h-10 rounded-lg bg-dream-600 px-4 font-medium text-white hover:bg-dream-700 disabled:opacity-40">{phase === 'translating' ? '正在翻译…' : phase === 'generating' ? '正在生成…' : phase === 'applying' ? '正在应用…' : locale === 'ja' ? '生成日语试听' : '生成中文试听'}</button></div>
    {job?.outputUrl && <div className="mt-3 space-y-3 rounded-lg border border-dream-100 bg-white p-3">
      <p className="leading-5 text-slate-500">实际朗读：<span lang={job.language} className="text-slate-800">{job.text}</span></p>
      <audio aria-label="当前台词配音试听" controls src={job.outputUrl} className="h-9 w-full" />
      <div className="flex flex-wrap items-center gap-2"><button disabled={busy || !candidateMatches} onClick={() => void apply()} className="rounded-lg bg-dream-600 px-3 py-2 font-medium text-white disabled:opacity-40">试听满意，应用到{locale === 'zh' ? '中文' : '日文'}轨</button>{locale === 'ja' && <button disabled={busy} className="px-2 py-2 text-dream-700 underline" onClick={() => setManualTranslation({ text: job.text, sourceHash })}>调整译文</button>}</div>
      {locale === 'ja' && manualTranslation?.sourceHash === sourceHash && <label className="block leading-5 text-slate-600">可选：调整日语表达，修改后重新生成<textarea aria-label="调整日语配音译文" lang="ja" rows={3} value={manualTranslation.text} onChange={(event) => setManualTranslation({ text: event.target.value, sourceHash })} className="mt-1 w-full rounded-lg border border-dream-200 p-2 text-sm" /></label>}
      {!candidateMatches && <p className="text-amber-700">原文、角色或译文已变化，请重新生成对应版本。</p>}
    </div>}
    {error && <p role="alert" className="mt-2 leading-5 text-rose-700">{error}</p>}
  </section>
}
