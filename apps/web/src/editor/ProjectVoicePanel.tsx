import { useEffect, useRef, useState } from 'react'
import { Headphones, Loader2, Mic2, X } from 'lucide-react'
import { readLocalizationFields, voiceTextHash, type StoryLocale } from '@dreamchord/story-domain'
import { acceptVoiceGeneration, bindCharacterVoice, createVoiceGeneration, getVoiceGenerationJob, getVoiceProfiles, translateVoiceText, unbindCharacterVoice, type Asset, type VoiceGenerationJob, type VoiceProfile } from '../api/client'
import { useEditorStore } from '../stores/editorStore'
import { planCharacterVoices, projectVoiceLocale, saveProjectVoiceLocale, VOICE_BINDINGS_CHANGED, type PlannedVoiceLine } from '../voice/characterVoicePlan'
import { apiError } from '../voice/VoiceProfileEditor'
import VoicePickerDialog from '../voice/VoicePickerDialog'
import { AUTOMATIC_VOICE_CHANGED, automaticVoiceEnabled, saveAutomaticVoice } from '../voice/automaticVoicePreference'

interface Take { line: PlannedVoiceLine; language: StoryLocale; job?: VoiceGenerationJob; error?: string; applied?: boolean; excluded?: boolean }
export default function ProjectVoicePanel({ open, onClose, characters }: { open: boolean; onClose: () => void; characters: Array<{ id: string; name: string }> }) {
  const projectId = useEditorStore((state) => state.project?.id) || ''
  const chapterId = useEditorStore((state) => state.chapterId)
  const nodes = useEditorStore((state) => state.nodes)
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [automatic, setAutomatic] = useState(() => automaticVoiceEnabled(projectId))
  const [locale, setLocale] = useState<StoryLocale>(() => projectVoiceLocale(projectId))
  const [regenerate, setRegenerate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bindingBusy, setBindingBusy] = useState('')
  const [pickingCharacter, setPickingCharacter] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [takes, setTakes] = useState<Take[]>([])
  const stopped = useRef(false)
  const alive = useRef(true)
  const scope = `${projectId}:${chapterId}`
  const latestScope = useRef(scope)
  latestScope.current = scope
  const title = useRef<HTMLHeadingElement>(null)
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    const read = () => setAutomatic(automaticVoiceEnabled(projectId))
    read(); window.addEventListener(AUTOMATIC_VOICE_CHANGED, read)
    return () => window.removeEventListener(AUTOMATIC_VOICE_CHANGED, read)
  }, [projectId])
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopped.current = true } }, [])
  useEffect(() => {
    stopped.current = true
    setTakes([]); setBusy(false); setLocale(projectVoiceLocale(projectId)); setError(''); setProgress('')
  }, [projectId, chapterId])
  useEffect(() => {
    if (!open) { stopped.current = true; return }
    const previous = document.activeElement as HTMLElement | null
    let active = true
    setLoading(true)
    void getVoiceProfiles().then((items) => { if (active) setProfiles(items) }).catch(() => { if (active) setError('无法读取角色音色，请重试。') }).finally(() => { if (active) setLoading(false) })
    title.current?.focus()
    return () => { active = false; previous?.focus() }
  }, [open])
  const plan = planCharacterVoices(nodes, profiles, projectId, locale, regenerate)
  const changeBinding = async (characterId: string, profileId: string) => {
    setBindingBusy(characterId); setError('')
    try {
      const previous = profiles.flatMap((profile) => profile.bindings).find((binding) => binding.project.id === projectId && binding.character.id === characterId)
      const binding = profileId ? await bindCharacterVoice(profileId, { projectId, characterId }) : undefined
      if (!profileId && previous) await unbindCharacterVoice(previous.id)
      setProfiles((current) => current.map((profile) => ({ ...profile, bindings: [...profile.bindings.filter((item) => item.character.id !== characterId), ...(binding && profile.id === profileId ? [binding] : [])] })))
      window.dispatchEvent(new Event(VOICE_BINDINGS_CHANGED))
      return true
    } catch (cause) { setError(apiError(cause, '角色音色保存失败，请重试。')); return false }
    finally { setBindingBusy('') }
  }
  const generate = async () => {
    const pending = plan.pending.filter((line) => !takes.some((take) => !take.excluded && take.language === locale && take.line.nodeId === line.nodeId && take.line.sourceHash === line.sourceHash && take.line.profileId === line.profileId && take.job?.status === 'completed'))
    if (!pending.length || busy) return
    stopped.current = false; setBusy(true); setError('')
    try {
      for (let index = 0; index < pending.length && !stopped.current && alive.current; index++) {
        const line = pending[index]!
        setProgress(`${index + 1} / ${pending.length} · ${line.characterName}${locale === 'ja' && !line.spokenText ? ' · 正在翻译中文' : ''}`)
        let take: Take
        try {
          const spoken = line.spokenText || (await translateVoiceText(line.sourceText)).text
          if (stopped.current || !alive.current || latestScope.current !== scope) break
          setProgress(`${index + 1} / ${pending.length} · ${line.characterName} · 正在生成${locale === 'ja' ? '日语' : '中文'}配音`)
          let job = await createVoiceGeneration({ projectId, characterId: line.characterId, ...(chapterId ? { chapterId } : {}), nodeId: line.nodeId, referenceId: line.referenceId, language: locale, text: spoken, sourceText: line.sourceText, sourceLanguage: 'zh', directionMode: 'auto' })
          const deadline = Date.now() + 240000
          while (['queued', 'running'].includes(job.status) && alive.current && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 1500))
            if (!alive.current || latestScope.current !== scope) return
            job = await getVoiceGenerationJob(job.id)
          }
          if (job.status !== 'completed') throw new Error(job.errorMessage || '任务尚未完成，可在声音库查看。')
          take = { line, language: locale, job }
        } catch (cause) {
          take = { line, language: locale, error: apiError(cause, cause instanceof Error ? cause.message : '这句生成失败') }
          if ((cause as { response?: { status?: number } })?.response?.status === 503) { stopped.current = true; setError('翻译或配音服务暂不可用，已停止后续提交。已完成的试听仍保留。') }
        }
        if (alive.current && latestScope.current === scope) setTakes((current) => [...current.filter((item) => item.line.nodeId !== line.nodeId || item.language !== locale), take])
      }
    } finally { if (alive.current && latestScope.current === scope) { setBusy(false); setProgress(stopped.current ? '已停止提交后续台词，完成的结果仍可试听。' : '本轮生成结束，可试听后统一应用。') } }
  }
  const apply = async () => {
    setApplying(true); setError('')
    const records = new Map<string, { take: Take; asset: Asset }>()
    let skipped = 0
    const candidates = takes.filter((take) => take.job?.status === 'completed' && !take.applied && !take.excluded)
    for (const take of candidates) {
      const { line, job, language } = take
      if (!job) continue
      try {
        const current = useEditorStore.getState()
        const node = current.nodes.find((item) => item.id === line.nodeId)
        const matches = node && current.project?.id === projectId && current.chapterId === chapterId && String(node.data.role || '') === line.role && voiceTextHash(String(node.data.text || '')) === line.sourceHash
        const bound = profiles.find((profile) => profile.id === line.profileId && profile.bindings.some((binding) => binding.character.id === line.characterId))
        if (!matches || !bound) { skipped++; continue }
        const asset = job.acceptedAsset || await acceptVoiceGeneration(job.id, { name: `${line.characterName} · ${language === 'ja' ? '日语' : '中文'} · ${line.sourceText.slice(0, 14)}` })
        records.set(`${line.nodeId}:${language}`, { take, asset })
        setTakes((items) => items.map((item) => item.job?.id === job.id ? { ...item, job: { ...job, acceptedAsset: asset } } : item))
      } catch (cause) { setError(apiError(cause, '部分配音未能入库，可再次应用。')) }
    }
    const current = useEditorStore.getState()
    if (current.project?.id === projectId && current.chapterId === chapterId && records.size) {
      const applied = new Set<string>()
      const next = current.nodes.map((node) => {
        let data = node.data
        for (const language of ['zh', 'ja'] as const) {
          const record = records.get(`${node.id}:${language}`)
          if (!record?.take.job) continue
          const { take, asset } = record
          const { line, job } = take
          if (!job || voiceTextHash(String(data.text || '')) !== line.sourceHash || String(data.role || '') !== line.role) { skipped++; continue }
          const fields = readLocalizationFields(data)
          if ((fields.voiceTracks?.[language]?.url || '') !== (line.originalTrackUrl || '') || (language === 'ja' && (fields.localizations?.ja?.text || '') !== (line.originalJa || '') && fields.localizations?.ja?.text !== job.text)) { skipped++; continue }
          data = { ...data, ...(language === 'ja' ? { localizations: { ...fields.localizations, ja: { ...fields.localizations?.ja, text: job.text, sourceHash: line.sourceHash } } } : {}), voiceTracks: { ...fields.voiceTracks, [language]: { url: asset.url, textHash: voiceTextHash(job.text), profileId: line.profileId } } }
          applied.add(job.id)
        }
        return data === node.data ? node : { ...node, data }
      })
      if (applied.size) current.commitGraph(next, current.edges)
      setTakes((items) => items.map((take) => take.job && applied.has(take.job.id) ? { ...take, applied: true } : take))
      setProgress(`已自动关联 ${applied.size} 句配音，中文字幕保留。${skipped ? `另有 ${skipped} 句内容或音色已变化，未覆盖。` : ''}`)
    } else if (skipped) setProgress(`有 ${skipped} 句内容或绑定已变化，没有应用旧配音。请按新内容重新生成。`)
    setApplying(false)
  }
  if (!open) return null
  const available = takes.filter((take) => take.job?.status === 'completed' && !take.applied && !take.excluded).length
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-6" onKeyDown={(event) => {
    if (event.key === 'Escape' && !applying) onClose()
    if (event.key === 'Tab') {
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), audio[controls]') || [])
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label="角色配音工作台" className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6"><div><p className="flex items-center gap-2 text-xs font-semibold text-dream-600"><Mic2 className="h-4 w-4" />声线分配</p><h2 ref={title} tabIndex={-1} className="mt-2 text-xl font-bold text-slate-950 outline-none">角色绑定一次，台词自动沿用</h2><p className="mt-2 text-sm leading-6 text-slate-500">本章节按说话角色使用固定音色。只写中文，也能批量生成日语配音。</p></div><button aria-label="关闭角色配音" disabled={applying} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-dream-200 bg-[#faf8fd] p-4"><input aria-label="自动准备角色配音" type="checkbox" checked={automatic} disabled={busy || applying} onChange={(event) => saveAutomaticVoice(projectId, event.target.checked)} className="mt-1 h-4 w-4 accent-dream-600" /><span><span className="block text-sm font-semibold text-slate-900">自动配音，写完后自动关联</span><span className="mt-1 block text-xs leading-6 text-slate-500">绑定角色后继续写中文即可。关闭此面板，系统会优先准备当前场景，再补齐本章；修改台词只更新对应片段。关闭开关可手动试听、精修。</span></span></label>
        <div className="rounded-xl border border-dream-100 bg-dream-50 p-4 text-sm leading-6 text-slate-700">游戏文字默认显示中文。配音语言独立选择，玩家可在播放设置里切换字幕；生成日语不会把中文台词改成日文。</div>
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-slate-50 p-4"><label className="text-sm font-medium text-slate-700">配音语言<select aria-label="批量配音语言" disabled={busy || applying} value={locale} onChange={(event) => { const next = event.target.value as StoryLocale; setLocale(next); saveProjectVoiceLocale(projectId, next) }} className="mt-2 block min-h-10 rounded-lg border border-slate-200 bg-white px-3"><option value="zh">中文配音</option><option value="ja">日语配音 · 自动翻译中文</option></select></label><div className="text-xs leading-6 text-slate-500"><p>已有有效配音 {plan.ready} 句 · 待生成 {plan.pending.length} 句</p><p>{plan.unbound ? `${plan.unbound} 句缺少音色或参考样本，会保留无声` : '已有配音会保留，仅生成缺失或已修改的台词'}</p></div></div>
        {loading ? <p className="text-sm text-slate-500">正在读取音色…</p> : <div className="grid gap-3 sm:grid-cols-2">{characters.map((character) => {
          const profile = profiles.find((item) => item.bindings.some((binding) => binding.project.id === projectId && binding.character.id === character.id))
          return <div key={character.id} className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-900"><div className="flex items-center justify-between gap-2"><span>{character.name}</span><button aria-label={`试听并更换${character.name}的音色`} disabled={busy || applying || Boolean(bindingBusy)} onClick={() => setPickingCharacter(character)} className="min-h-9 text-xs font-medium text-dream-700">试听选音色</button></div><select aria-label={`${character.name}的固定音色`} disabled={busy || applying || Boolean(bindingBusy)} value={profile?.id || ''} onChange={(event) => void changeBinding(character.id, event.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"><option value="">不配音／暂不绑定</option>{profiles.filter((item) => item.status === 'active' || item.id === profile?.id).map((item) => <option key={item.id} value={item.id}>{item.name}{item.status !== 'active' ? '（已停用）' : ''}</option>)}</select><span className="mt-2 block text-xs font-normal text-slate-500">{profile ? '这个角色的后续台词都会沿用此音色' : '点击“试听选音色”，比较声线后再分配'}</span></div>
        })}</div>}
        {!characters.length && <p className="text-sm text-slate-500">项目还没有角色，可先在素材库添加项目角色。</p>}
        {!automatic && <label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={regenerate} disabled={busy || applying} onChange={(event) => setRegenerate(event.target.checked)} className="mt-1 accent-dream-600" />按当前绑定音色重录已有配音（适合更换声线或调整表演后使用，试听应用前保留原音频）</label>}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {progress && <p role="status" className="text-sm text-dream-700">{progress}</p>}
        {takes.length > 0 && <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Headphones className="h-4 w-4 text-dream-600" />本轮试听 · 自动对应角色和台词</h3>{takes.map((take) => <article key={`${take.line.nodeId}-${take.language}`} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3 text-xs text-slate-500"><span>{take.line.characterName} · {take.language === 'ja' ? '日语' : '中文'}</span><span>{take.applied ? '已应用' : take.error ? '生成失败' : take.excluded ? '本轮不采用' : '待试听'}</span></div><p className="mt-2 text-sm leading-6 text-slate-800">{take.line.sourceText}</p>{take.language === 'ja' && take.job && <p lang="ja" className="mt-1 text-xs leading-5 text-slate-500">{take.job.text}</p>}{take.job?.outputUrl && <audio aria-label={`${take.line.characterName}配音试听`} controls preload="none" src={take.job.outputUrl} className="mt-3 h-9 w-full" />}{take.error && <p className="mt-2 text-xs text-rose-600">{take.error}</p>}{take.job && !take.applied && <button disabled={busy || applying} onClick={() => setTakes((items) => items.map((item) => item === take ? { ...item, excluded: !item.excluded } : item))} className="mt-2 min-h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50">{take.excluded ? '重新纳入应用' : '本轮不采用'}</button>}</article>)}</section>}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 sm:px-6">{automatic ? <><p className="max-w-lg text-xs leading-6 text-slate-500">音色与语言会记住。回到编辑器后，后台自动翻译、合成并保存；可随时暂停。已有录音会保留。</p><button onClick={onClose} className="dc-primary">完成，自动准备配音</button></> : <><p className="max-w-sm text-xs leading-5 text-slate-500">先生成、集中试听，再一次应用。关闭面板会停止后续提交，正在生成的任务保留在声音库。</p><div className="flex flex-wrap gap-2">{busy ? <button onClick={() => { stopped.current = true }} className="dc-secondary">停止后续生成</button> : <button disabled={loading || applying || Boolean(bindingBusy) || !plan.pending.length} onClick={() => void generate()} className="dc-secondary">{regenerate ? '按当前音色重录' : '生成缺失台词'}</button>}<button disabled={busy || applying || !available} onClick={() => void apply()} className="dc-primary">{applying && <Loader2 className="h-4 w-4 animate-spin" />}试听满意，应用 {available} 句</button></div></>}</footer>
    </section>
    {pickingCharacter && <VoicePickerDialog profiles={profiles} characterName={pickingCharacter.name} currentId={profiles.find((profile) => profile.bindings.some((binding) => binding.character.id === pickingCharacter.id))?.id} onClose={() => setPickingCharacter(null)} onChoose={async (profile) => { if (!await changeBinding(pickingCharacter.id, profile.id)) throw new Error('角色音色保存失败，请重试。') }} />}
  </div>
}
