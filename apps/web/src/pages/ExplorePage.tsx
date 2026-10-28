import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Loader2, RefreshCw } from 'lucide-react'
import { getPublicProjects, type ProjectDetail } from '../api/client'
import AppHeader from '../components/AppHeader'
import StudioIntro from '../components/StudioIntro'
import { projectCover } from '../lib/projectCover'

export default function ExplorePage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setProjects(await getPublicProjects()) }
    catch { setError('作品暂时无法加载，请重试。') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const filtered = useMemo(() => projects.filter((project) => {
    const official = project.id === 'dreamchord-first-thread'
    const matches = `${project.title} ${project.description || ''} ${project.author.nickname || project.author.username}`.toLowerCase().includes(query.trim().toLowerCase())
    return matches && (category === 'all' || (category === 'official' ? official : !official))
  }), [category, projects, query])

  return (
    <main className="dc-page">
      <AppHeader />
      <div className="dc-content">
      <StudioIntro className="mb-8" image="/assets/ui/scene-collection.webp"><div><p className="text-xs font-semibold tracking-[0.18em] text-slate-600">故事书架</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">发现作品</h1><p className="mt-3 max-w-md text-sm leading-7 text-slate-500">走进别人的故事，找到自己的下一次灵感。从官方示例开始，也可以看看创作者们留下的不同结局。</p><Link to="/play/dreamchord-first-thread" className="dc-primary mt-5">试玩官方示例</Link></div></StudioIntro>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div role="group" aria-label="作品分类" className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">{[['all', '全部作品'], ['official', '官方示例'], ['community', '创作者作品']].map(([value, label]) => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)} className={`rounded-lg px-4 py-2 text-sm font-medium ${category === value ? 'bg-dream-600 text-white' : 'text-slate-600 hover:bg-dream-50'}`}>{label}</button>)}</div><label className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="搜索作品" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作品、作者或故事简介" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm" /></label></div>
      {error && <div role="alert" className="dc-panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-rose-700">{error}<button onClick={() => void load()} className="dc-secondary"><RefreshCw className="h-4 w-4" />重新加载</button></div>}
      {loading ? <div className="dc-panel flex justify-center gap-2 py-20 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />正在整理故事书架…</div> : <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((project) => (
          <ProjectCard key={project.id} project={project} onClick={() => navigate(`/play/${project.id}`)} />
        ))}
      </div>}
      {!loading && !error && !filtered.length && <div className="dc-panel px-6 py-14 text-center"><img src="/assets/illustrations/empty-projects.png" alt="" className="mx-auto h-32 w-32 object-contain" /><h2 className="mt-4 text-lg font-bold text-slate-950">{projects.length ? '没有找到符合条件的故事' : '书架上还没有公开作品'}</h2><p className="mt-2 text-sm text-slate-500">{projects.length ? '换一个关键词，或查看全部作品。' : '先试玩官方示例，或回到首页创作自己的故事。'}</p><button onClick={() => { setQuery(''); setCategory('all') }} className="dc-secondary mt-5">查看全部作品</button></div>}
      </div>
    </main>
  )
}

function ProjectCard({
  project,
  onClick,
}: {
  project: ProjectDetail
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full overflow-hidden rounded-2xl border border-dream-100 bg-white/70 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-dream-500/40"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={projectCover(project)}
          alt={project.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="font-semibold text-slate-950 group-hover:text-slate-600 transition">{project.title}</h3>
          {project.isPublished && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">已发布</span>
          )}
        </div>
        <p className="text-sm text-slate-600">{project.author.nickname || project.author.username}</p>
        {project.description && (
          <p className="mt-2 line-clamp-2 text-xs text-slate-500">{project.description}</p>
        )}
        <div className="mt-4 flex items-center text-xs text-slate-400">
          <span className="group-hover:text-slate-500 transition">点击游玩 →</span>
        </div>
      </div>
    </button>
  )
}
