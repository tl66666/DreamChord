import { useEffect, useId, useMemo, useState } from 'react'
import { Check, ImagePlus, Loader2 } from 'lucide-react'
import { uploadAsset } from '../api/client'
import type { ProjectData } from '../stores/editorStore'
import { projectCover } from '../lib/projectCover'

const covers = [
  { name: '留白手稿', url: '/assets/covers/story-draft.webp' },
  { name: '消失的终页', url: '/assets/covers/first-thread.webp' },
  { name: '樱花来信', url: '/assets/backgrounds/bg-sakura.png' },
  { name: '星夜约定', url: '/assets/backgrounds/bg-starry.png' },
]
const inputClass = 'mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-dream-400 focus:ring-2 focus:ring-dream-100'
export default function ProjectDetailsForm({ project, onSave, onCancel, onDirtyChange, onBusyChange }: {
  project: ProjectData; onSave: (data: Partial<ProjectData>) => Promise<void> | void; onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void
}) {
  const id = useId()
  const initial = useMemo(() => ({ title: project.title, description: project.description || '', cover: projectCover(project), defaultVoiceLocale: project.defaultVoiceLocale || 'zh', defaultSubtitleLocale: project.defaultSubtitleLocale || 'zh', isPublic: !!project.isPublic }), [project])
  const [values, setValues] = useState(initial)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { onDirtyChange?.(!!file || JSON.stringify(values) !== JSON.stringify(initial)) }, [values, initial, file, onDirtyChange])
  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file); setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const choose = (url: string) => { setFile(null); setValues((old) => ({ ...old, cover: url })); setError('') }
  return <form onSubmit={async (event) => {
    event.preventDefault()
    if (busy) return
    setError(''); setBusy(true); onBusyChange?.(true)
    try {
      let cover = values.cover
      if (file) {
        const asset = await uploadAsset(file, 'CG', project.id)
        cover = asset.url; setValues((old) => ({ ...old, cover })); setFile(null)
      }
      await onSave({ ...values, title: values.title.trim(), cover })
    } catch (cause) {
      const serverMessage = (cause as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(serverMessage || (cause instanceof Error ? cause.message : '保存失败，请稍后重试'))
    } finally { setBusy(false); onBusyChange?.(false) }
  }} className="space-y-6">
    {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <fieldset disabled={busy} className="grid gap-6 disabled:opacity-70 sm:grid-cols-2">
      <div className="contents">
        <div className="overflow-hidden rounded-2xl border border-dream-100 bg-dream-50"><img src={preview || values.cover} alt="故事封面预览" className="aspect-[16/10] w-full object-cover" onError={(event) => { event.currentTarget.src = '/assets/covers/story-draft.webp' }} /><p className="px-4 py-3 text-xs leading-5 text-slate-500">封面会用于故事书架与作品广场。切换图片不会修改剧情背景。</p></div>
        <div className="space-y-4"><label className="block text-sm font-medium text-slate-700">故事名称<input aria-label="故事名称" required maxLength={200} value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} className={inputClass} /></label><label className="block text-sm font-medium text-slate-700">故事简介<textarea aria-label="故事简介" maxLength={10000} rows={4} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="写下故事的开端、主角与悬念……" className={inputClass} /></label></div>
      </div>
      <section><h3 className="text-sm font-semibold text-slate-900">挑选故事封面</h3><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{covers.map((cover) => <button key={cover.url} type="button" aria-label={`使用${cover.name}封面`} aria-pressed={!file && values.cover === cover.url} onClick={() => choose(cover.url)} className={`overflow-hidden rounded-xl border text-left transition ${!file && values.cover === cover.url ? 'border-dream-500 ring-2 ring-dream-100' : 'border-slate-200 hover:border-dream-300'}`}><img src={cover.url} alt="" className="aspect-[16/10] w-full object-cover" /><span className="flex items-center justify-between gap-1 px-2.5 py-2 text-xs text-slate-700">{cover.name}{!file && values.cover === cover.url && <Check className="h-3.5 w-3.5 text-dream-600" />}</span></button>)}</div>
        <input id={`${id}-upload`} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const next = event.target.files?.[0]; event.target.value = ''; if (!next) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type) || next.size > 10 * 1024 * 1024) { setError('请选择 10MB 以内的 PNG、JPG 或 WebP 图片'); return } setFile(next); setError('') }} />
        <label htmlFor={`${id}-upload`} tabIndex={busy ? -1 : 0} onKeyDown={(event) => { if (!busy && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); document.getElementById(`${id}-upload`)?.click() } }} className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-dream-50"><ImagePlus className="h-4 w-4" />上传自己的封面</label><span className="ml-3 text-xs text-slate-400">PNG / JPG / WebP · 10MB 内</span>
        <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer py-2">使用已有图片地址</summary><label>封面图片地址<input aria-label="封面图片地址" value={values.cover} onChange={(event) => choose(event.target.value)} className={inputClass} /></label></details>
      </section>
      <section className="rounded-2xl border border-dream-100 bg-dream-50/40 p-4 sm:p-5"><h3 className="font-semibold text-slate-900">文字与角色配音</h3><p className="mt-1 text-xs leading-6 text-slate-500">故事默认设置会随作品保存，编辑配音与打开播放器时自动采用。读者也能在播放设置中单独调整。</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">默认字幕语言<select aria-label="默认字幕语言" value={values.defaultSubtitleLocale} onChange={(event) => setValues({ ...values, defaultSubtitleLocale: event.target.value as 'zh' | 'ja' })} className={inputClass}><option value="zh">简体中文</option><option value="ja">日本語</option></select></label><label className="text-sm font-medium text-slate-700">默认配音语言<select aria-label="默认配音语言" value={values.defaultVoiceLocale} onChange={(event) => setValues({ ...values, defaultVoiceLocale: event.target.value as 'zh' | 'ja' })} className={inputClass}><option value="zh">中文配音</option><option value="ja">日语配音 · 中文原稿自动翻译</option></select></label></div><p className="mt-3 text-xs leading-6 text-dream-700">选日语配音也可以继续写中文。先为角色绑定音色，再在编辑器开启自动配音；播放器使用已准备好的对应音轨。</p></section>
      <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2"><input type="checkbox" checked={values.isPublic} onChange={(event) => setValues({ ...values, isPublic: event.target.checked })} />发布后在公开作品广场展示</label>
    </fieldset>
    <div className="sticky -bottom-6 flex justify-end gap-3 border-t border-slate-100 bg-white/95 py-4 backdrop-blur"><button type="button" disabled={busy} onClick={onCancel} className="dc-secondary">取消</button><button type="submit" disabled={busy || !values.title.trim()} className="dc-primary">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? '正在保存…' : '保存故事设置'}</button></div>
  </form>
}
