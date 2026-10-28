import { useState } from 'react'
import type { CharacterVoiceBinding, ProjectDetail, VoiceProfile } from '../api/client'
import { bindCharacterVoice } from '../api/client'
import LibraryDialog from '../library/LibraryDialog'
import { languageName, voiceLanguages, voicePresentation, voicePreviewUrl } from './voiceCatalog'
import { apiError } from './VoiceProfileEditor'

export default function VoiceAssignmentDialog({ profile, profiles, projects, initialProjectId = '', onSaved, onClose, onEditProject }: { profile: VoiceProfile; profiles: VoiceProfile[]; projects: ProjectDetail[]; initialProjectId?: string; onSaved: (binding: CharacterVoiceBinding) => void; onClose: () => void; onEditProject: (projectId: string) => void }) {
  const first = projects.find((project) => project.id === initialProjectId) || projects.find((project) => profile.bindings.some((binding) => binding.project.id === project.id)) || projects.find((project) => project.characters.length) || projects[0]
  const [projectId, setProjectId] = useState(first?.id || '')
  const [characterId, setCharacterId] = useState('')
  const [language, setLanguage] = useState(voiceLanguages(profile)[0] || 'zh')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const project = projects.find((item) => item.id === projectId)
  const current = profiles.find((item) => item.bindings.some((binding) => binding.character.id === characterId && binding.project.id === projectId))
  const save = async () => {
    if (!characterId || busy) return
    setBusy(true); setError('')
    try { const binding = await bindCharacterVoice(profile.id, { projectId, characterId }); onSaved(binding); setSaved(true) }
    catch (cause) { setError(apiError(cause, '角色音色分配失败，请重试。')) }
    finally { setBusy(false) }
  }
  const url = voicePreviewUrl(profile, language)
  return <LibraryDialog title="分配音色给角色" description="音色绑定一次，之后在编辑器里按角色自动使用。" busy={busy} onClose={onClose} footer={<div className="flex flex-wrap justify-end gap-2"><button disabled={busy} onClick={onClose} className="dc-secondary">{saved ? '完成' : '取消'}</button>{saved ? <button onClick={() => onEditProject(projectId)} className="dc-primary">去编辑器生成配音</button> : <button disabled={!characterId || busy || profile.status !== 'active' || current?.id === profile.id} onClick={() => void save()} className="dc-primary">{busy ? '正在保存…' : current?.id === profile.id ? '角色已使用这个音色' : '保存角色音色'}</button>}</div>}>
    <div className="rounded-xl border border-dream-100 bg-dream-50/50 p-4"><h3 className="font-bold text-slate-950">{voicePresentation(profile).name}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{voicePresentation(profile).description}</p><div className="mt-3 flex flex-wrap items-center gap-2"><select aria-label="分配前试听语言" value={language} onChange={(event) => setLanguage(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">{voiceLanguages(profile).map((item) => <option key={item} value={item}>{languageName(item)}</option>)}</select>{url && <audio key={url} aria-label="分配前音色试听" controls preload="none" src={url} className="h-9 min-w-0 flex-1" />}</div></div>
    <label className="mt-5 block text-sm font-medium text-slate-700">选择故事<select aria-label="分配音色的故事" disabled={busy} value={projectId} onChange={(event) => { setProjectId(event.target.value); setCharacterId(''); setSaved(false) }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3">{projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <fieldset className="mt-5"><legend className="text-sm font-medium text-slate-700">选择角色</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{project?.characters.map((character) => {
      const voice = profiles.find((item) => item.bindings.some((binding) => binding.project.id === projectId && binding.character.id === character.id))
      return <label key={character.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${characterId === character.id ? 'border-dream-300 bg-dream-50' : 'border-slate-200 bg-white'}`}><input type="radio" name="voice-assignment-character" aria-label={`分配给${character.name}`} checked={characterId === character.id} disabled={busy} onChange={() => { setCharacterId(character.id); setSaved(false) }} className="mt-1 accent-dream-600" /><span className="min-w-0"><span className="block text-sm font-semibold text-slate-950">{character.name}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{voice ? `当前：${voicePresentation(voice).name}` : '尚未分配音色'}</span></span></label>
    })}</div></fieldset>
    {!project?.characters.length && <p className="mt-3 text-sm leading-6 text-slate-500">这个故事还没有角色，可先在编辑器中添加角色。</p>}
    {characterId && current && current.id !== profile.id && !saved && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">保存后会更换该角色的固定声线。已经生成的对白仍保留，可在编辑器中按新音色重录。</p>}
    {saved && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">已保存。角色后续台词将沿用这个音色。</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
  </LibraryDialog>
}
