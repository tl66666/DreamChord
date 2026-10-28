import { useEffect, useRef, useState } from 'react'
import { Loader2, Save, Trash2, X } from 'lucide-react'
import type { VoiceProfile } from '../api/client'
import { updateVoiceProfile, deleteVoiceProfile } from '../api/client'

export default function VoiceProfileEditor({ profile, onSaved, onDeleted, onClose }: {
  profile: VoiceProfile; onSaved: (profile: VoiceProfile) => void; onDeleted: (id: string) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState({ name: profile.name, description: profile.description, language: profile.language.split('-')[0], genderTone: profile.genderTone || '', ageTone: profile.ageTone || '', defaultEmotion: profile.defaultEmotion, defaultSpeed: profile.defaultSpeed })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLElement>('input')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)') || [])
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [busy, onClose])
  const save = async (status?: VoiceProfile['status']) => {
    setBusy(true); setError('')
    try { onSaved(await updateVoiceProfile(profile.id, { ...draft, ...(status ? { status } : {}) })); onClose() }
    catch (cause) { setError(apiError(cause, '保存失败，请检查字段后重试。')) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setError('')
    try { await deleteVoiceProfile(profile.id); onDeleted(profile.id); onClose() }
    catch (cause) { setError(apiError(cause, '删除失败，该音色可能仍被引用。')); setConfirmDelete(false) }
    finally { setBusy(false) }
  }
  return <div className="fixed inset-0 z-[95] flex justify-end bg-slate-950/50 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label="编辑音色档案" className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-200 p-6"><div><p className="text-xs font-semibold tracking-widest text-dream-700">VOICE SETTINGS</p><h3 className="mt-1 text-xl font-bold text-slate-950">编辑音色档案</h3><p className="mt-2 text-sm text-slate-500">修改资料与默认表演，不会改变已经生成的配音。</p></div><button aria-label="关闭音色设置" disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <label className="block text-sm font-medium">音色名称<input aria-label="编辑音色名称" value={draft.name} maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass} /></label>
        <label className="block text-sm font-medium">角色与适用场景<textarea aria-label="音色说明" value={draft.description} maxLength={1000} rows={3} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={inputClass} /></label>
        <div className="grid grid-cols-2 gap-4"><label className="text-sm font-medium">主要语言<select aria-label="音色主要语言" value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })} className={inputClass}><option value="zh">中文</option><option value="ja">日本語</option><option value="en">English</option></select></label><label className="text-sm font-medium">声线<select aria-label="编辑性别声线" value={draft.genderTone} onChange={(event) => setDraft({ ...draft, genderTone: event.target.value })} className={inputClass}><option value="">未设置</option><option>女声</option><option>男声</option><option>中性</option></select></label></div>
        <label className="block text-sm font-medium">年龄感<input aria-label="编辑年龄感" value={draft.ageTone} maxLength={60} onChange={(event) => setDraft({ ...draft, ageTone: event.target.value })} className={inputClass} /></label>
        <label className="block text-sm font-medium">默认情绪<input aria-label="默认情绪" value={draft.defaultEmotion} maxLength={80} onChange={(event) => setDraft({ ...draft, defaultEmotion: event.target.value })} className={inputClass} /></label>
        <label className="block text-sm font-medium">默认语速 {draft.defaultSpeed.toFixed(2)}×<input aria-label="默认语速" type="range" min="0.75" max="1.2" step="0.01" value={draft.defaultSpeed} onChange={(event) => setDraft({ ...draft, defaultSpeed: Number(event.target.value) })} className="mt-3 w-full accent-dream-700" /></label>
        <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><p className="font-semibold text-slate-800">来源与授权</p>{profile.authorizationNote || '尚无来源说明'}</div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="border-t border-slate-200 pt-4"><button disabled={busy} onClick={() => void save(profile.status === 'active' ? 'disabled' : 'active')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{profile.status === 'active' ? '停用这个音色' : '恢复使用'}</button><p className="mt-2 text-xs leading-5 text-slate-500">停用后不能继续生成，现有配音和来源记录仍可保留。</p></div>
        {confirmDelete ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm text-rose-900">确定删除“{profile.name}”的档案？已引用或有历史配音的档案不能删除。</p><div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void remove()} className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white">确认删除档案</button><button disabled={busy} onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm">取消</button></div></div> : <button disabled={busy} onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 text-sm text-rose-600"><Trash2 className="h-4 w-4" />删除音色档案</button>}
      </div>
      <div className="flex gap-3 border-t border-slate-200 p-5"><button disabled={busy} onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">取消</button><button disabled={busy || !draft.name.trim()} onClick={() => void save()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存设置</button></div>
    </section>
  </div>
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-dream-600 focus:ring-2 focus:ring-dream-100'
export function apiError(error: unknown, fallback: string) {
  const response = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error
  return typeof response === 'string' ? response : fallback
}
