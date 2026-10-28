import { useState, type ReactNode } from 'react'
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { LibraryScene } from '../lib/libraryData'
import { getMyProjects, type ProjectDetail } from '../api/client'
import AudioWorkspaceHeader from './AudioWorkspaceHeader'
import LibraryDialog from './LibraryDialog'

export default function SceneCatalog({ scenes, editor, onCreate, onEdit, onDelete, onReset, onUse, initialProjectId = '' }: { scenes: LibraryScene[]; editor?: ReactNode; onCreate: () => void; onEdit: (scene: LibraryScene) => void; onDelete: (id: string) => void; onReset: () => void; onUse: (scene: LibraryScene, projectId: string) => void; initialProjectId?: string }) {
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState('全部场所')
  const [time, setTime] = useState('全部时间')
  const [mood, setMood] = useState('全部氛围')
  const [preview, setPreview] = useState<LibraryScene | null>(null)
  const [using, setUsing] = useState<LibraryScene | null>(null)
  const [projects, setProjects] = useState<ProjectDetail[]>([])
  const [projectId, setProjectId] = useState(initialProjectId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const filtered = scenes.filter((scene) => `${scene.name} ${scene.description} ${scene.usage} ${scene.moods?.join(' ')}`.includes(query.trim()) && (place === '全部场所' || (scene.place || scene.type) === place) && (time === '全部时间' || scene.timeOfDay === time) && (mood === '全部氛围' || scene.moods?.includes(mood)))
  const clear = () => { setQuery(''); setPlace('全部场所'); setTime('全部时间'); setMood('全部氛围') }
  const chooseScene = async (scene: LibraryScene) => {
    setPreview(null); setUsing(scene); setLoading(true); setError('')
    try { const items = await getMyProjects(); setProjects(items); setProjectId(items.some((item) => item.id === initialProjectId) ? initialProjectId : items[0]?.id || '') }
    catch { setError('故事列表暂时无法读取，请重试。') }
    finally { setLoading(false) }
  }
  return <div>
    <AudioWorkspaceHeader kind="scene" count={scenes.length} action={<><button onClick={onCreate} className="dc-primary"><Plus className="h-4 w-4" />新增背景</button><button onClick={onReset} className="dc-secondary">恢复内置背景</button></>} />
    {editor}
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3 lg:grid-cols-[minmax(160px,1.6fr)_1fr_1fr_1fr]">
      <label className="relative sm:col-span-3 lg:col-span-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><span className="sr-only">搜索背景场景</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索画面或剧情用途" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm" /></label>
      <select aria-label="背景场所" value={place} onChange={(event) => setPlace(event.target.value)} className={control}><option>全部场所</option>{[...new Set(scenes.map((scene) => scene.place || scene.type).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="背景时间" value={time} onChange={(event) => setTime(event.target.value)} className={control}><option>全部时间</option>{[...new Set(scenes.map((scene) => scene.timeOfDay).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="背景氛围" value={mood} onChange={(event) => setMood(event.target.value)} className={control}><option>全部氛围</option>{[...new Set(scenes.flatMap((scene) => scene.moods || []))].map((item) => <option key={item}>{item}</option>)}</select>
    </div>
    <p className="my-4 text-xs text-slate-500">找到 {filtered.length} 个背景 · 点击画面查看完整构图</p>
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((scene) => <article key={scene.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-dream-200 hover:shadow-sm"><button aria-label={`预览${scene.name}`} onClick={() => setPreview(scene)} className="group relative block aspect-video w-full overflow-hidden bg-slate-100"><img src={scene.url} alt={scene.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /><span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-slate-950/60 px-2 py-1 text-[11px] text-white opacity-0 backdrop-blur transition group-hover:opacity-100"><Eye className="h-3 w-3" />预览大图</span></button><div className="p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-950">{scene.name}</h3><p className="mt-1 text-xs text-slate-500">{[scene.place || scene.type, scene.timeOfDay].filter(Boolean).join(' · ')}</p></div><div className="flex"><button aria-label={`编辑${scene.name}`} onClick={() => onEdit(scene)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button><button aria-label={`删除${scene.name}`} onClick={() => onDelete(scene.id)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></div></div><p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{scene.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{scene.moods?.map((item) => <span key={item} className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-600">{item}</span>)}</div><div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><span className="line-clamp-1 text-[11px] text-slate-400" title={scene.usage}>{scene.usage}</span><button onClick={() => void chooseScene(scene)} className="dc-primary shrink-0 !min-h-9 !px-3 !text-xs">用于故事</button></div></div></article>)}</div>
    {!filtered.length && <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-12 text-center"><p className="text-sm text-slate-500">没有符合条件的背景</p><button onClick={clear} className="mt-3 text-sm text-dream-600 underline">清空筛选</button></div>}
    {preview && <LibraryDialog wide title={preview.name} description={[preview.place || preview.type, preview.timeOfDay, ...(preview.moods || [])].filter(Boolean).join(' · ')} onClose={() => setPreview(null)} footer={<div className="flex justify-end gap-2"><button onClick={() => setPreview(null)} className="dc-secondary">关闭预览</button><button onClick={() => void chooseScene(preview)} className="dc-primary">用于故事</button></div>}><img src={preview.url} alt={`${preview.name}完整背景`} className="w-full rounded-xl object-contain" /><p className="mt-4 text-sm leading-6 text-slate-600">{preview.description}</p><p className="mt-2 text-xs leading-5 text-slate-500">适合：{preview.usage}</p></LibraryDialog>}
    {using && <LibraryDialog title="把背景带入故事" description={`已选择“${using.name}”。进入编辑器后选择目标场景，再点击应用。`} onClose={() => setUsing(null)} footer={<div className="flex justify-end gap-2"><button onClick={() => setUsing(null)} className="dc-secondary">取消</button><button disabled={loading || !projectId} onClick={() => onUse(using, projectId)} className="dc-primary">进入编辑器选场景</button></div>}><img src={using.url} alt={using.name} className="aspect-video w-full rounded-xl object-cover" /><label className="mt-5 block text-sm font-medium text-slate-700">选择故事<select aria-label="使用背景的故事" value={projectId} disabled={loading} onChange={(event) => setProjectId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3">{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>{loading && <p className="mt-3 text-xs text-slate-500">正在读取故事…</p>}{!loading && !projects.length && <p className="mt-3 text-sm text-slate-500">先在首页创建一个故事，再来选择背景。</p>}{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}</LibraryDialog>}
  </div>
}
const control = 'h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600'
