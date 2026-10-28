import { useState } from 'react'
import type { VoiceProfile } from '../api/client'
import LibraryDialog from '../library/LibraryDialog'
import VoiceCatalogCard from './VoiceCatalogCard'
import { hasVoiceReference, languageName, voiceLanguages, voicePresentation, voicePreviewUrl } from './voiceCatalog'
import { apiError } from './VoiceProfileEditor'

export default function VoicePickerDialog({ profiles, characterName, currentId, onChoose, onClose }: { profiles: VoiceProfile[]; characterName: string; currentId?: string; onChoose: (profile: VoiceProfile) => Promise<void>; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<VoiceProfile | null>(null)
  const [language, setLanguage] = useState('zh')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const choices = profiles.filter((profile) => profile.status === 'active' && hasVoiceReference(profile) && `${voicePresentation(profile).name} ${voicePresentation(profile).traits.join(' ')} ${voicePresentation(profile).roles.join(' ')} ${profile.description}`.includes(query.trim())).sort((a, b) => Number(voicePresentation(b).example === characterName) - Number(voicePresentation(a).example === characterName))
  const choose = async (profile: VoiceProfile) => {
    setBusy(true); setError('')
    try { await onChoose(profile); onClose() }
    catch (cause) { setError(apiError(cause, '音色分配失败，请重试。')) }
    finally { setBusy(false) }
  }
  const url = preview ? voicePreviewUrl(preview, language) : undefined
  return <LibraryDialog wide title={`为${characterName}选择音色`} description="先试听，再分配。保存后，这个角色的后续台词都会沿用所选音色。" onClose={onClose} busy={busy} footer={preview ? <div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{voicePresentation(preview).name}</p><p className="mt-1 text-xs text-slate-500">试听样音与游戏字幕语言互相独立</p></div><select aria-label="选音色试听语言" value={language} onChange={(event) => setLanguage(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs">{voiceLanguages(preview).map((item) => <option key={item} value={item}>{languageName(item)}</option>)}</select>{url ? <audio key={url} aria-label="选音色试听播放器" autoPlay controls src={url} className="h-10 w-full sm:max-w-sm" /> : <p className="text-xs text-slate-500">这个音色暂没有对应样音</p>}</div> : <p className="text-xs leading-5 text-slate-500">音色是角色的固定声线；每句对白的情绪和语速仍可单独调整。</p>}>
    <label className="mb-4 block"><span className="sr-only">搜索可分配音色</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索声线、性格或适用人物，如温柔、旁白" className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm" /></label>
    {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{choices.map((profile) => <VoiceCatalogCard key={profile.id} profile={profile} active={profile.id === currentId} canPreview={voiceLanguages(profile).some((item) => voicePreviewUrl(profile, item))} onPreview={() => { setPreview(profile); setLanguage(voiceLanguages(profile)[0] || 'zh') }} action={<button disabled={busy || profile.id === currentId} onClick={() => void choose(profile)} className="dc-primary !min-h-9 !px-3 !text-xs">{profile.id === currentId ? '当前使用' : `分配给${characterName}`}</button>} />)}</div>
    {!choices.length && <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">没有找到可用音色，换个关键词，或先到声音库创建音色。</p>}
  </LibraryDialog>
}
