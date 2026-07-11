import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  Trash2,
  Download,
  Menu,
  Upload,
  X,
} from 'lucide-react'
import { createProject, deleteProject, exportProjectBackup, getMyProjects, importProjectBackup, updateProject, type ProjectDetail } from '../api/client'
import { useAuthStore } from '../stores/authStore'
import { useToast, useConfirm } from '../components/FeedbackProvider'

function getApiError(err: unknown, fallback = '操作失败'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    return response?.data?.error || fallback
  }
  return err instanceof Error ? err.message || fallback : fallback
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user, isLoading, logout } = useAuthStore()
  const toast = useToast()
  const confirm = useConfirm()
  const [creating, setCreating] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [myProjects, setMyProjects] = useState<ProjectDetail[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    setProjectsLoading(true)
    getMyProjects()
      .then(setMyProjects)
      .catch(console.error)
      .finally(() => setProjectsLoading(false))
  }, [user])

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
      if (file.size > 10 * 1024 * 1024) throw new Error('备份文件不能超过 10MB')
      const imported = await importProjectBackup(JSON.parse(await file.text()))
      setMyProjects(await getMyProjects()); toast.success(`已导入「${imported.title}」`); navigate(`/editor/${imported.id}`)
    } catch (error) { toast.error(getApiError(error, error instanceof SyntaxError ? '备份文件不是有效 JSON' : '导入失败')) }
    finally { if (importInputRef.current) importInputRef.current.value = '' }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/assets/logo.png" alt="DreamChord" className="h-10 w-10 rounded-xl ring-1 ring-black/5" />
            <span className="text-lg font-bold text-slate-950 sm:text-xl">DreamChord</span>
          </Link>
          <div className="hidden items-center gap-4 md:flex">
            <Link to="/library" className="text-sm font-medium text-slate-700 hover:text-dream-600">素材库</Link>
            <Link to="/agent" className="text-sm font-medium text-slate-700 hover:text-dream-600">创作 Agent</Link>
            <Link to="/explore" className="text-sm font-medium text-slate-700 hover:text-dream-600">发现作品</Link>
            <Link to="/settings" className="text-sm font-medium text-slate-700 hover:text-dream-600">设置</Link>
            {!isLoading && (user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-700">{user.nickname || user.username}</span>
                <button onClick={logout} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">退出</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">登录</Link>
                <Link to="/register" className="rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700">注册</Link>
              </div>
            ))}
          </div>
          <button
            type="button"
            aria-label={mobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-700 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && <div role="navigation" aria-label="移动端导航" className="mx-auto mt-3 max-w-7xl border-t border-slate-200 pt-3 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            <Link onClick={() => setMobileMenuOpen(false)} to="/library" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">素材库</Link>
            <Link onClick={() => setMobileMenuOpen(false)} to="/agent" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">创作 Agent</Link>
            <Link onClick={() => setMobileMenuOpen(false)} to="/explore" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">发现作品</Link>
            <Link onClick={() => setMobileMenuOpen(false)} to="/settings" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">设置</Link>
          </div>
          {!isLoading && (user ? <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="truncate text-sm text-slate-600">{user.nickname || user.username}</span>
            <button type="button" aria-label="退出登录" onClick={logout} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">退出</button>
          </div> : <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
            <Link onClick={() => setMobileMenuOpen(false)} to="/login" className="rounded-md px-3 py-2 text-center text-sm font-medium text-slate-700">登录</Link>
            <Link onClick={() => setMobileMenuOpen(false)} to="/register" className="rounded-md bg-dream-600 px-3 py-2 text-center text-sm font-medium text-white">注册</Link>
          </div>)}
        </div>}
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-14 lg:grid-cols-[1fr_520px]">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-dream-200 bg-white px-4 py-1.5 text-sm text-dream-700">
            <Sparkles className="h-4 w-4" />
            节点剧情 · 独立素材库 · Agent 创作闭环
          </div>
          <h1 className="text-5xl font-bold leading-tight text-slate-950">
            把模糊灵感
            <br />
            变成能玩的视觉小说
          </h1>
          <p className="max-w-xl text-lg leading-8 text-slate-700">
            DreamChord 把故事项目、角色设定、背景素材和剧情结构放进同一条创作链路。创作 Agent 会读取项目上下文，先规划和校验，再由你预览、应用或撤销变更。
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleCreate} disabled={creating} className="rounded-lg bg-dream-600 px-6 py-3 font-medium text-white shadow-lg shadow-dream-500/20 hover:bg-dream-700 disabled:opacity-50">
              {creating ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 创建中</span> : '新建故事'}
            </button>
            <Link to="/library" className="rounded-lg border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">打开素材库</Link>
            <Link to="/play/dreamchord-first-thread" className="rounded-lg border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">试玩演示</Link>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-dream-300/20 blur-3xl" />
          <img src="/assets/hero.png" alt="DreamChord 编辑器预览" className="relative rounded-lg border border-white shadow-2xl" />
        </div>
      </section>

      {user && (
        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-dream-600">故事项目</p>
              <h2 className="text-2xl font-bold text-slate-950">我的作品</h2>
            </div>
            <div className="flex gap-2"><input ref={importInputRef} type="file" accept=".json,.dreamchord.json,application/json" className="hidden" onChange={(event) => void handleImport(event.target.files?.[0])} /><button type="button" onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"><Upload className="h-4 w-4" />导入备份</button><button onClick={handleCreate} disabled={creating} className="rounded-lg bg-dream-600 px-5 py-2 text-sm font-medium text-white hover:bg-dream-700 disabled:opacity-50">新建故事</button></div>
          </div>
          {projectsLoading ? (
            <div className="flex h-32 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中...</div>
          ) : myProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">还没有故事。先新建一个项目，再到素材库上传它专属的角色、背景和音效。</div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {myProjects.map((project) => (
                <div key={project.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${project.cover || '/assets/covers/default-cover.png'})` }} />
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
                            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
                            autoFocus
                          />
                          <button onClick={() => confirmRename(project.id)} className="rounded p-1 text-green-600 hover:bg-green-50"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditingId(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <h3 className="font-semibold text-slate-950">{project.title}</h3>
                      )}
                      {editingId !== project.id && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => void handleExport(project)} className="rounded p-1 text-cyan-700 hover:bg-cyan-50" title="导出备份"><Download className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { setEditingId(project.id); setEditingTitle(project.title) }} className="rounded p-1 text-slate-500 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(project.id)} disabled={deletingId === project.id} className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50">
                            {deletingId === project.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mb-4 line-clamp-2 text-sm text-slate-600">{project.description || '暂无简介'}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Link to={`/editor/${project.id}`} className="rounded-md bg-dream-600 py-2 text-center text-sm font-medium text-white hover:bg-dream-700">编辑</Link>
                      <Link to={`/play/${project.id}`} className="rounded-md border border-slate-200 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">预览</Link>
                      <Link to="/library" className="rounded-md border border-slate-200 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">素材</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8">
          <p className="text-sm font-semibold text-dream-600">完整创作闭环</p>
          <h2 className="text-2xl font-bold text-slate-950">三个入口，对应三个真实工作区</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <FeatureCard
            icon={<GitBranch className="h-5 w-5" />}
            title="故事工作台"
            desc="新建或编辑故事项目，在线性工作台里上下移动节点，也可以切到节点图检查分支连线。"
            items={['故事可新建、重命名、删除', '选项会生成独立剧情出口', '播放器按选择进入对应后续']}
            action="新建故事"
            onClick={handleCreate}
          />
          <FeatureCard
            icon={<Archive className="h-5 w-5" />}
            title="素材库与设定"
            desc="独立管理角色、背景、剧情素材和项目上传素材。进入素材库不会创建新故事。"
            items={['角色和场景可编辑删除', '立绘状态可点击预览', '剧情素材可新建、修改、删除']}
            action="打开素材库"
            onClick={() => navigate('/library')}
          />
          <FeatureCard
            icon={<Bot className="h-5 w-5" />}
            title="创作 Agent"
            desc="基于故事圣经和真实章节结构诊断问题，生成经过规则校验的节点图变更。"
            items={['先展示计划和上下文来源', '变更应用前可预览差异', '应用后保留版本并支持撤销']}
            action="打开创作 Agent"
            onClick={() => navigate('/agent')}
          />
        </div>
      </section>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  desc,
  items,
  action,
  onClick,
}: {
  icon: ReactNode
  title: string
  desc: string
  items: string[]
  action: string
  onClick: () => void
}) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
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
