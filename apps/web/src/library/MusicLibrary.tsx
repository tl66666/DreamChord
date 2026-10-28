import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Disc3, Edit3, FileAudio, Loader2, Music2, Pause, Play, Search, Sparkles, Trash2, Upload, Volume2, X } from 'lucide-react'
import type { Asset, AudioLibraryMetadata } from '../api/client'
import AudioWorkspaceHeader from './AudioWorkspaceHeader'

type MusicKind = 'BGM' | 'SFX'
type UpdateDetails = { name?: string; audioLibrary?: AudioLibraryMetadata }

interface MusicLibraryProps {
  assets: Asset[]
  loading: boolean
  onUpload: (file: File, type: MusicKind) => Promise<void> | void
  onUpdate: (assetId: string, details: UpdateDetails) => Promise<Asset>
  onDelete: (asset: Asset) => Promise<void | boolean> | void | boolean
}

interface MusicEntry { asset: Asset; metadata: AudioLibraryMetadata; durationSeconds?: number }

const moodOptions = ['全部情绪', '日常', '温柔', '轻快', '忧郁', '紧张', '神秘', '治愈', '热血']
const styleOptions = ['全部风格', '视觉小说原声', '氛围', '钢琴', '电子', '管弦', '摇滚', '环境', '提示音']
const covers = [
  'from-indigo-950 via-violet-700 to-fuchsia-400',
  'from-slate-950 via-dream-800 to-emerald-400',
  'from-rose-950 via-orange-700 to-amber-300',
  'from-blue-950 via-indigo-700 to-sky-300',
  'from-zinc-950 via-slate-700 to-purple-400',
]

export default function MusicLibrary({ assets, loading, onUpload, onUpdate, onDelete }: MusicLibraryProps) {
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const [kind, setKind] = useState<MusicKind>('BGM')
  const [query, setQuery] = useState('')
  const [mood, setMood] = useState('全部情绪')
  const [style, setStyle] = useState('全部风格')
  const [current, setCurrent] = useState<MusicEntry | null>(null)
  const [editing, setEditing] = useState<MusicEntry | null>(null)
  const [draft, setDraft] = useState({ name: '', mood: '', style: '', scene: '', loop: true, license: '', source: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const entries = useMemo(() => assets.filter((asset) => asset.type === kind).map(readMusicEntry), [assets, kind])
  const availableMoods = useMemo(() => [...new Set([...moodOptions, ...entries.flatMap((entry) => splitTags(entry.metadata.mood))])], [entries])
  const availableStyles = useMemo(() => [...new Set([...styleOptions, ...entries.flatMap((entry) => splitTags(entry.metadata.style))])], [entries])
  const filtered = useMemo(() => entries.filter((entry) => {
    const haystack = `${entry.asset.name} ${entry.metadata.mood || ''} ${entry.metadata.style || ''} ${entry.metadata.scene || ''}`.toLowerCase()
    return (!query.trim() || haystack.includes(query.trim().toLowerCase()))
      && (mood === '全部情绪' || splitTags(entry.metadata.mood).includes(mood))
      && (style === '全部风格' || splitTags(entry.metadata.style).includes(style))
  }), [entries, mood, query, style])

  const openEditor = (entry: MusicEntry) => {
    setEditing(entry)
    setDraft({
      name: entry.asset.name,
      mood: entry.metadata.mood || '',
      style: entry.metadata.style || '',
      scene: entry.metadata.scene || '',
      loop: entry.metadata.loop ?? entry.asset.type === 'BGM',
      license: entry.metadata.license || '',
      source: entry.metadata.source || '',
    })
  }

  const save = async () => {
    if (!editing || !draft.name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const updated = await onUpdate(editing.asset.id, {
        name: draft.name.trim(),
        audioLibrary: { mood: draft.mood.trim(), style: draft.style.trim(), scene: draft.scene.trim(), loop: draft.loop, license: draft.license.trim(), source: draft.source.trim() },
      })
      if (current?.asset.id === updated.id) setCurrent(readMusicEntry(updated))
      setEditing(null)
    } catch { setError('音乐信息保存失败，请重试。') } finally { setSaving(false) }
  }

  return (
    <div className="pb-24">
      <AudioWorkspaceHeader kind="music" count={assets.filter((asset) => asset.type === 'BGM' || asset.type === 'SFX').length} action={<button onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-white"><Upload className="h-4 w-4" />导入声音素材</button>} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><span className="rounded-full bg-dream-50 p-2 text-dream-700"><Music2 className="h-5 w-5" /></span><h2 className="text-2xl font-bold text-slate-950">音乐库</h2></div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">集中管理 BGM 与音效，用情绪、风格和剧情场景快速筛选；试听不会打断你的素材整理。</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-dream-800">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}上传{kind === 'BGM' ? '音乐' : '音效'}
          <input ref={uploadRef} aria-label="上传音乐或音效" type="file" accept="audio/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file, kind); event.target.value = '' }} />
        </label>
      </div>

      <div className="mt-6 flex w-fit rounded-xl bg-slate-100 p-1" role="group" aria-label="音乐素材类型">
        {([['BGM', '背景音乐', Music2], ['SFX', '音效', Volume2]] as const).map(([value, label, Icon]) => <button key={value} onClick={() => { setKind(value); setMood('全部情绪'); setStyle('全部风格') }} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${kind === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`} aria-label={label === '背景音乐' ? '背景音乐' : '音效'}><Icon className="h-4 w-4" />{label}</button>)}
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-[minmax(220px,1.5fr)_1fr_1fr]" aria-label="音乐筛选">
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">搜索音乐</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、剧情场景" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-dream-500" /></label>
        <select aria-label="音乐情绪" value={mood} onChange={(event) => setMood(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">{availableMoods.map((option) => <option key={option}>{option}</option>)}</select>
        <select aria-label="音乐风格" value={style} onChange={(event) => setStyle(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">{availableStyles.map((option) => <option key={option}>{option}</option>)}</select>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((entry, index) => {
          const active = current?.asset.id === entry.asset.id
          return <article key={entry.asset.id} className={`group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:shadow-lg ${active ? 'border-dream-400 shadow-md shadow-dream-100' : 'border-slate-200'}`}>
            <div className="flex gap-4 p-4">
              <button type="button" aria-label={`试听${entry.asset.name}`} onClick={() => setCurrent(active ? null : entry)} className={`relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${covers[(hash(entry.asset.id) + index) % covers.length]} text-white shadow-inner`}>
                <span className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 30% 25%, white 0 2px, transparent 3px), linear-gradient(135deg, transparent 45%, white 46% 48%, transparent 49%)' }} />
                <span className="relative rounded-full bg-black/35 p-3 backdrop-blur-sm">{active ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}</span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate font-bold text-slate-950">{entry.asset.name}</h3><p className="mt-1 text-xs text-slate-400">{entry.asset.type === 'BGM' ? '背景音乐' : '剧情音效'} · {entry.metadata.loop ? '可循环' : '单次播放'}</p></div><div className="flex shrink-0 items-center gap-1"><span className="text-xs font-semibold tabular-nums text-dream-700">{formatDuration(entry.durationSeconds)}</span><button aria-label={`编辑${entry.asset.name}`} onClick={() => openEditor(entry)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"><Edit3 className="h-4 w-4" /></button></div></div>
                <div className="mt-3 flex flex-wrap gap-1.5">{[entry.metadata.mood, entry.metadata.style, entry.metadata.scene].filter(Boolean).map((tag) => <span key={tag} className="rounded-full border border-dream-100 bg-dream-50 px-2 py-0.5 text-[11px] font-medium text-dream-800">{tag}</span>)}{!entry.metadata.mood && !entry.metadata.style && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">待补充标签</span>}</div>
                <p className="mt-3 truncate text-[11px] text-slate-400">{entry.metadata.license ? `授权：${entry.metadata.license}` : '请补充授权来源'}</p>
              </div>
            </div>
          </article>
        })}
      </div>

      {!loading && !filtered.length && <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center"><FileAudio className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">{entries.length ? '没有符合筛选条件的素材' : kind === 'BGM' ? '音乐库还是空的' : '音效库还是空的'}</p><p className="mt-1 text-sm text-slate-500">上传音频后，就能在镜头卡中直接选择并试听。</p></div>}

      {current && <div data-testid="music-player-tray" className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white shadow-2xl shadow-slate-400/40">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${covers[hash(current.asset.id) % covers.length]}`}><Disc3 className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{current.asset.name}</p><p className="text-xs text-slate-400">{current.metadata.scene || '试听中'} · {current.metadata.loop ? '循环素材' : '单次素材'}</p></div>
        <audio key={current.asset.url} aria-label="音乐库持续播放器" controls autoPlay loop={Boolean(current.metadata.loop)} preload="metadata" src={current.asset.url} className="h-10 w-full max-w-xl md:w-[420px]">你的浏览器不支持音频预览。</audio>
        <button onClick={() => setCurrent(null)} aria-label="关闭播放器" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
      </div>}

      {editing && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}>
        <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl" aria-label="编辑音乐信息">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-dream-700">Audio dossier</p><h3 className="mt-1 text-2xl font-bold text-slate-950">整理音乐信息</h3><p className="mt-2 text-sm leading-6 text-slate-500">这些字段用于筛选与剧情选曲，不会修改原始音频。</p></div><button onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          <div className="mt-6 space-y-4">
            <Field label="素材名称"><input aria-label="素材名称" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={fieldClass} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="情绪"><input aria-label="情绪" value={draft.mood} onChange={(event) => setDraft({ ...draft, mood: event.target.value })} placeholder="如：温柔、紧张" className={fieldClass} /></Field><Field label="风格"><input aria-label="风格" value={draft.style} onChange={(event) => setDraft({ ...draft, style: event.target.value })} placeholder="如：钢琴、氛围" className={fieldClass} /></Field></div>
            <Field label="适用场景"><input aria-label="适用场景" value={draft.scene} onChange={(event) => setDraft({ ...draft, scene: event.target.value })} placeholder="如：雨夜独白、校园日常" className={fieldClass} /></Field>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input type="checkbox" checked={draft.loop} onChange={(event) => setDraft({ ...draft, loop: event.target.checked })} className="mt-1 h-4 w-4 accent-dream-700" /><span><span className="block text-sm font-semibold text-slate-800">适合循环播放</span><span className="mt-1 block text-xs leading-5 text-slate-500">BGM 通常开启，门铃、爆炸等一次性音效应关闭。</span></span></label>
            <Field label="授权方式"><input aria-label="授权方式" value={draft.license} onChange={(event) => setDraft({ ...draft, license: event.target.value })} placeholder="如：原创、CC0、已购商用授权" className={fieldClass} /></Field>
            <Field label="来源 / 备注"><textarea aria-label="来源或备注" rows={3} value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} placeholder="记录作者、网址或授权凭证位置" className={`${fieldClass} resize-none`} /></Field>
          </div>
          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="mt-8 flex gap-3"><button onClick={() => void save()} disabled={saving || !draft.name.trim()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-dream-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}保存音乐信息</button><button onClick={() => void Promise.resolve(onDelete(editing.asset)).then((deleted) => { if (deleted === false) return; if (current?.asset.id === editing.asset.id) setCurrent(null); setEditing(null) }).catch(() => setError('素材正在被使用或删除失败，请先检查引用。'))} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" />删除</button></div>
          <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50 p-4"><div className="flex gap-3"><Sparkles className="h-5 w-5 shrink-0 text-violet-600" /><p className="text-xs leading-5 text-violet-900">建议按“剧情功能”命名和标记，例如日常垫乐、告白高潮、悬疑揭晓，比只写曲风更方便编剧选择。</p></div></div>
        </aside>
      </div>}
    </div>
  )
}

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-dream-500 focus:ring-2 focus:ring-dream-100'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>
}

function readMusicEntry(asset: Asset): MusicEntry {
  try {
    const parsed = JSON.parse(asset.metadata || '{}') as { audioLibrary?: AudioLibraryMetadata; starterMusic?: { durationSeconds?: number }; officialSoundtrack?: { durationSeconds?: number } }
    const duration = parsed.officialSoundtrack?.durationSeconds ?? parsed.starterMusic?.durationSeconds
    return {
      asset,
      metadata: parsed.audioLibrary && typeof parsed.audioLibrary === 'object' ? parsed.audioLibrary : {},
      ...(Number.isFinite(duration) ? { durationSeconds: duration } : {}),
    }
  } catch { return { asset, metadata: {} } }
}

function splitTags(value?: string) { return (value || '').split(/[/、，,]/).map((tag) => tag.trim()).filter(Boolean) }

function formatDuration(seconds?: number) {
  if (!Number.isFinite(seconds)) return '--:--'
  const whole = Math.max(0, Math.round(seconds!))
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

function hash(value: string) {
  return Array.from(value).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
}
