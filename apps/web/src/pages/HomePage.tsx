import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  Bot,
  Check,
  GitBranch,
  Loader2,
  Pencil,
  PlayCircle,
  Sparkles,
  Search,
  Mic2,
  Trash2,
  Download,
  Upload,
  X,
  Settings2,
} from 'lucide-react'
import { createProject, deleteProject, exportProjectBackup, getMyProjects, importProjectBackup, updateProject, type ProjectDetail } from '../api/client'
import { useAuthStore } from '../stores/authStore'
import { useToast, useConfirm } from '../components/FeedbackProvider'
import AppHeader from '../components/AppHeader'
import { projectCover } from '../lib/projectCover'
import ProjectSettingsModal from '../editor/ProjectSettingsModal'
import HomeShowcase from '../components/HomeShowcase'
import { saveProjectVoiceLocale } from '../voice/characterVoicePlan'

export const MAX_PROJECT_BACKUP_BYTES = 90 * 1024 * 1024

function getApiError(err: unknown, fallback = '操作失败'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    return response?.data?.error || fallback
  }
  return err instanceof Error ? err.message || fallback : fallback
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const toast = useToast()
  const confirm = useConfirm()
  const [creating, setCreating] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [myProjects, setMyProjects] = useState<ProjectDetail[]>([])
  const [projectQuery, setProjectQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [projectsError, setProjectsError] = useState('')
  const [reload, setReload] = useState(0)
  const visibleProjects = useMemo(() => myProjects.filter((project) => `${project.title} ${project.description || ''}`.toLowerCase().includes(projectQuery.trim().toLowerCase()) && (projectFilter === 'all' || (projectFilter === 'published' ? project.isPublished : !project.isPublished))), [myProjects, projectQuery, projectFilter])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [settingsProject, setSettingsProject] = useState<ProjectDetail | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    setProjectsError('')
    setProjectsLoading(true)
    getMyProjects()
      .then((items) => { if (active) setMyProjects(items) })
      .catch(() => { if (active) setProjectsError('暂时无法读取你的故事，请稍后重试。') })
      .finally(() => { if (active) setProjectsLoading(false) })
    return () => { active = false }
  }, [user, reload])

  const handleCreate = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    setCreating(true)
    try {
      const project = await createProject({ title: '我的新故事' })
      navigate(`/editor/${project.id}`)
    } catch (err: unknown) {
      toast.error(getApiError(err, '创建项目失败，请先登录'))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!await confirm({ message: '确定删除这个故事项目吗？删除后章节、节点和项目素材都会被清理。', danger: true })) return
    setDeletingId(id)
    try {
      await deleteProject(id)
      setMyProjects((prev) => prev.filter((project) => project.id !== id))
    } catch (err: unknown) {
      toast.error(getApiError(err, '删除失败'))
    } finally {
      setDeletingId(null)
    }
  }

  const confirmRename = async (id: string) => {
    const title = editingTitle.trim()
    if (!title) return
    try {
      const updated = await updateProject(id, { title })
      setMyProjects((prev) => prev.map((project) => (project.id === id ? { ...project, title: updated.title } : project)))
      setEditingId(null)
    } catch (err: unknown) {
      toast.error(getApiError(err, '重命名失败'))
    }
  }

  const handleExport = async (project: ProjectDetail) => {
    try {
      const manifest = await exportProjectBackup(project.id)
      const url = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = `${project.title}.dreamchord.json`; link.click(); URL.revokeObjectURL(url)
    } catch (error) { toast.error(getApiError(error, '导出失败')) }
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    try {
      if (file.size > MAX_PROJECT_BACKUP_BYTES) throw new Error('备份文件不能超过 90MB')
      const imported = await importProjectBackup(JSON.parse(await file.text()))
      setMyProjects(await getMyProjects()); toast.success(`已导入「${imported.title}」`); navigate(`/editor/${imported.id}`)
    } catch (error) { toast.error(getApiError(error, error instanceof SyntaxError ? '备份文件不是有效 JSON' : '导入失败')) }
    finally { if (importInputRef.current) importInputRef.current.value = '' }
  }

  return (
    <div className="dc-page">
      <AppHeader />

      <section className="dc-home-hero">
        <img src="/assets/ui/home-writing-world.webp" alt="" aria-hidden="true" loading="eager" decoding="async" className="dc-home-hero-art" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-8 pt-10 sm:py-16 lg:py-20"><div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-3 py-1.5 text-xs font-medium text-dream-700 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            梦弦 DreamChord · 视觉小说创作工房
          </div>
          <h1 className="text-4xl font-bold leading-[1.2] tracking-tight text-slate-950 sm:text-5xl lg:text-[54px]">
            把灵感写成
            <br />
            <span className="text-dream-700">可以游玩的故事</span>
          </h1>
          <p className="max-w-[28rem] text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
            写下第一句对白，安排一次相遇。为角色挑选声音，为选择留下不同的结局，慢慢搭建属于你的世界。
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleCreate} disabled={creating} className="rounded-lg bg-dream-600 px-6 py-3 font-medium text-white shadow-lg shadow-dream-500/20 hover:bg-dream-700 disabled:opacity-50">
              {creating ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 创建中</span> : '新建故事'}
            </button>
            <Link to="/play/dreamchord-first-thread" className="inline-flex items-center gap-2 rounded-lg border border-white bg-white/75 px-5 py-3 text-sm font-medium text-slate-700 backdrop-blur hover:bg-white"><PlayCircle className="h-4 w-4" />试玩官方示例</Link>
          </div>
          <Link to="/agent" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-600 hover:text-dream-700"><Bot className="h-4 w-4" />有一个想法？和创作助手聊聊 →</Link>
        </div></div><div aria-hidden="true" className="h-52 sm:hidden" />
      </section>

      {user && (
        <section id="my-stories" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-medium tracking-widest text-dream-600">继续创作</p>
              <h2 className="text-2xl font-bold text-slate-950">我的作品</h2>
            </div>
            <div className="flex flex-wrap gap-2"><input ref={importInputRef} type="file" accept=".json,.dreamchord.json,application/json" className="hidden" onChange={(event) => void handleImport(event.target.files?.[0])} /><button type="button" onClick={() => importInputRef.current?.click()} className="dc-secondary"><Upload className="h-4 w-4" />导入备份</button><button onClick={handleCreate} disabled={creating} className="dc-primary">新建故事</button></div>
          </div>
          {myProjects.length > 0 && <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div role="group" aria-label="我的故事状态" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">{[['all', '全部故事'], ['draft', '创作中'], ['published', '已发布']].map(([value, label]) => <button key={value} aria-pressed={projectFilter === value} onClick={() => setProjectFilter(value)} className={`min-h-9 rounded-lg px-3 text-xs font-medium sm:text-sm ${projectFilter === value ? 'bg-dream-50 text-dream-700' : 'text-slate-500 hover:bg-slate-50'}`}>{label}</button>)}</div><label className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><span className="sr-only">搜索我的故事</span><input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="找一个故事，继续写下去" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm" /></label></div>}
          {projectsError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-100 bg-white p-4 text-sm text-rose-700">{projectsError}<button className="dc-secondary" onClick={() => setReload((value) => value + 1)}>重新加载</button></div>}
          {projectsLoading ? (
            <div className="flex h-32 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中...</div>
          ) : !projectsError && myProjects.length === 0 ? (
            <div className="dc-studio-intro sm:!grid-cols-[220px_1fr]"><img src="/assets/ui/story-outline-collection.webp" alt="" className="mx-auto h-44 w-64 object-contain p-4 sm:h-full" /><div className="px-6 pb-6 sm:py-8"><h3 className="text-lg font-bold text-slate-900">你的第一幕，从这里开始</h3><p className="mt-2 text-sm leading-7 text-slate-500">先写一句对白也没关系。新建故事后，可以挑背景、绑定角色声音，再慢慢展开剧情。</p><button onClick={handleCreate} className="dc-primary mt-4">创建第一个故事</button></div></div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visibleProjects.map((project) => (
                <article key={project.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-dream-200 hover:shadow-lg hover:shadow-dream-100/30">
                  <div className="relative"><Link to={`/editor/${project.id}`} aria-label={`编辑${project.title}`} className="relative block aspect-[16/9] overflow-hidden"><img src={projectCover(project)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /><span className="absolute bottom-3 left-3 rounded-full border border-white/50 bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-700 backdrop-blur-sm">{project.isPublished ? '已发布' : '创作中'}</span></Link><button aria-label={`更换${project.title}的封面`} onClick={() => setSettingsProject(project)} className="absolute right-3 top-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-3 text-xs font-medium text-slate-700 shadow-sm backdrop-blur hover:bg-white"><Pencil className="h-3.5 w-3.5" />封面</button></div>
                  <div className="p-5">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      {editingId === project.id ? (
                        <div className="flex flex-1 items-center gap-1">
                          <input
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') confirmRename(project.id)
                              if (event.key === 'Escape') setEditingId(null)
                            }}
                            aria-label="新的故事名称" className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
                            autoFocus
                          />
                          <button aria-label="保存故事名称" onClick={() => confirmRename(project.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-green-600 hover:bg-green-50"><Check className="h-4 w-4" /></button>
                          <button aria-label="取消重命名" onClick={() => setEditingId(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <h3 className="font-semibold text-slate-950">{project.title}</h3>
                      )}
                      {editingId !== project.id && (
                        <div className="flex items-center gap-1">
                          <button aria-label={`设置${project.title}`} title="封面、简介与配音语言" onClick={() => setSettingsProject(project)} className="grid h-9 w-9 place-items-center rounded-lg text-dream-600 hover:bg-dream-50"><Settings2 className="h-4 w-4" /></button>
                          <button aria-label={`导出${project.title}的备份`} onClick={() => void handleExport(project)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-dream-50 hover:text-dream-700" title="导出备份"><Download className="h-3.5 w-3.5" /></button>
                          <button aria-label={`重命名${project.title}`} title="重命名" onClick={() => { setEditingId(project.id); setEditingTitle(project.title) }} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                          <button aria-label={`删除${project.title}`} title="删除故事" onClick={() => handleDelete(project.id)} disabled={deletingId === project.id} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
                            {deletingId === project.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mb-4 min-h-12 line-clamp-2 text-sm leading-6 text-slate-500">{project.description || '还没有简介，可以从角色与第一幕开始。'}</p>
                    <p className="mb-4 text-xs text-slate-400">{project.defaultVoiceLocale === 'ja' ? '日语配音' : '中文配音'}<span className="mx-2">·</span>{project.defaultSubtitleLocale === 'ja' ? '日文字幕' : '中文字幕'}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Link to={`/editor/${project.id}`} className="rounded-md bg-dream-600 py-2 text-center text-sm font-medium text-white hover:bg-dream-700">继续编辑</Link>
                      <Link to={`/agent?project=${project.id}`} className="inline-flex items-center justify-center gap-1 rounded-md bg-slate-950 py-2 text-center text-sm font-medium text-white hover:bg-dream-800"><Bot className="h-3.5 w-3.5" />问 Agent</Link>
                      <Link to={`/play/${project.id}`} className="rounded-md border border-slate-200 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">预览</Link>
                      <Link to={`/library?project=${project.id}`} className="rounded-md border border-slate-200 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">素材</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!projectsLoading && !projectsError && myProjects.length > 0 && !visibleProjects.length && <div className="dc-panel px-6 py-12 text-center"><h3 className="font-semibold text-slate-800">没有找到符合条件的故事</h3><button onClick={() => { setProjectQuery(''); setProjectFilter('all') }} className="dc-secondary mt-4">清空筛选</button></div>}
        </section>
      )}

      {settingsProject && <ProjectSettingsModal project={{ ...settingsProject, description: settingsProject.description || undefined }} characters={settingsProject.characters || []} onClose={() => setSettingsProject(null)} onUpdate={async (data) => {
        const updated = await updateProject(settingsProject.id, data)
        setMyProjects((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
        if (updated.defaultVoiceLocale) saveProjectVoiceLocale(updated.id, updated.defaultVoiceLocale)
        setSettingsProject(null); toast.success('故事设置已保存')
      }} />}

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8">
          <p className="text-sm font-semibold text-dream-600">完整创作闭环</p>
          <h2 className="text-2xl font-bold text-slate-950">从灵感到可以游玩的故事</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <FeatureCard
            icon={<GitBranch className="h-5 w-5" />}
            title="故事工作台"
            image="/assets/ui/story-outline-collection.webp"
            desc="新建或编辑故事项目，在线性工作台里上下移动节点，也可以切到节点图检查分支连线。"
            items={['故事名称、简介与封面随时修改', '选项会生成独立剧情出口', '播放器按选择进入对应后续']}
            action="新建故事"
            onClick={handleCreate}
          />
          <FeatureCard
            icon={<Archive className="h-5 w-5" />}
            title="挑选素材，搭建场景"
            image="/assets/ui/scene-collection.webp"
            desc="背景、立绘、音色和配乐按用途整理。先预览试听，再把合适的素材分配给故事。"
            items={['按场所和氛围查找背景', '试听音色后直接分配角色', '音乐、对白与音效分别管理']}
            action="打开素材库"
            onClick={() => navigate('/library')}
          />
          <FeatureCard
            icon={<Mic2 className="h-5 w-5" />}
            title="给角色一个熟悉的声音"
            image="/assets/ui/voice-collection.webp"
            desc="试听后把音色分配给角色。开启自动配音，继续写中文，系统会在后台准备对白。"
            items={['音色绑定一次，后续对白沿用', '中文显示与日语配音独立选择', '改了台词，只更新对应片段']}
            action="试听并分配音色"
            onClick={() => navigate('/library?tab=voices')}
          />
        </div>
      </section>
      <HomeShowcase />
    </div>
  )
}

function FeatureCard({
  icon,
  image,
  title,
  desc,
  items,
  action,
  onClick,
}: {
  icon: ReactNode
  image?: string
  title: string
  desc: string
  items: string[]
  action: string
  onClick: () => void
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      {image && <div className="-mx-6 -mt-6 mb-5 flex h-52 items-center justify-center overflow-hidden bg-[linear-gradient(115deg,#fcfaf6,#eee8f8)]"><img src={image} alt="" className={`h-full w-full ${image.includes('collection') ? 'object-contain p-3' : 'object-cover'}`} /></div>}
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-dream-50 text-dream-700 ring-1 ring-dream-100">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="text-sm leading-6 text-slate-700">{desc}</p>
      <ul className="mt-4 flex-1 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-xs text-slate-600">
            <Check className="h-3.5 w-3.5 text-dream-500" />
            {item}
          </li>
        ))}
      </ul>
      <button onClick={onClick} className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700">
        {action}
        <PlayCircle className="h-4 w-4" />
      </button>
    </article>
  )
}
