import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ChevronRight, Library, Loader2, Settings } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { StoryGraph, StoryNodeType } from '@dreamchord/story-domain'
import AgentWorkspace from '../agent/AgentWorkspace'
import type { AppliedPatchDto } from '../agent/agentTypes'
import { getMyProjects, getProject, type Chapter, type ProjectDetail } from '../api/client'

export default function AIWriterPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState<ProjectDetail[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('project') || '')
  const [selectedChapterId, setSelectedChapterId] = useState(searchParams.get('chapter') || '')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const selectedChapter = selectedProject?.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null
  const graph = useMemo(() => chapterToGraph(selectedChapter), [selectedChapter])
  const initialSelection = useRef({ projectId: selectedProjectId, chapterId: selectedChapterId })

  useEffect(() => {
    let active = true
    getMyProjects()
      .then(async (items) => {
        if (!active) return
        setProjects(items)
        const summary = items.find((item) => item.id === initialSelection.current.projectId) ?? items[0]
        if (!summary) return
        const project = await getProject(summary.id)
        if (!active) return
        const chapter = initialSelection.current.chapterId
          ? project.chapters.find((item) => item.id === initialSelection.current.chapterId)
          : undefined
        setSelectedProject(project)
        setSelectedProjectId(project.id)
        setSelectedChapterId(chapter?.id ?? '')
      })
      .catch(() => active && setError('项目加载失败，请稍后重试。'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('project', selectedProjectId)
      if (selectedChapterId) next.set('chapter', selectedChapterId)
      else next.delete('chapter')
      return next
    }, { replace: true })
  }, [selectedProjectId, selectedChapterId, setSearchParams])

  const selectProject = async (projectId: string) => {
    setSelectedProjectId(projectId)
    setSelectedProject(null)
    setSelectedChapterId('')
    setSelectedNodeId(null)
    setLoading(true)
    setError('')
    try {
      const project = await getProject(projectId)
      setSelectedProject(project)
      setSelectedChapterId('')
      setSearchParams({ project: projectId })
    } catch {
      setError('项目加载失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  const handleAppliedGraph = (result: AppliedPatchDto) => {
    setSelectedProject((project) => project ? {
      ...project,
      chapters: project.chapters.map((chapter) => chapter.id !== result.chapterId ? chapter : graphToChapter(chapter, result)),
    } : project)
  }

  const updateConversation = useCallback((conversationId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (selectedProjectId) next.set('project', selectedProjectId)
      if (selectedChapterId) next.set('chapter', selectedChapterId)
      else next.delete('chapter')
      next.set('conversation', conversationId)
      return next
    }, { replace: true })
  }, [selectedChapterId, selectedProjectId, setSearchParams])

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src="/assets/logo.png" alt="DreamChord" className="h-9 w-9 rounded-lg" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase text-slate-500">DreamChord / Narrative Control</p>
              <h1 className="truncate text-lg font-bold">创作 Agent</h1>
            </div>
          </Link>
          <nav className="flex items-center gap-1" aria-label="工作区导航">
            <button title="素材库" onClick={() => navigate('/library')} className="grid h-10 w-10 place-items-center rounded-md text-slate-600 hover:bg-slate-100"><Library className="h-4 w-4" /></button>
            <button title="模型设置" onClick={() => navigate('/settings')} className="grid h-10 w-10 place-items-center rounded-md text-slate-600 hover:bg-slate-100"><Settings className="h-4 w-4" /></button>
          </nav>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-12 shrink-0">项目</span>
              <select aria-label="选择项目" value={selectedProjectId} onChange={(event) => void selectProject(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 sm:w-64 sm:flex-none">
                {projects.length === 0 && <option value="">暂无项目</option>}
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </label>
            <ChevronRight className="hidden h-4 w-4 text-slate-300 sm:block" />
            <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-12 shrink-0">章节</span>
              <select aria-label="选择章节" value={selectedChapterId} onChange={(event) => { setSelectedChapterId(event.target.value); setSelectedNodeId(null) }} disabled={!selectedProject} className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 disabled:bg-slate-100 sm:w-72 sm:flex-none">
                <option value="">不绑定章节（项目对话）</option>
                {selectedProject?.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.order + 1}. {chapter.title}</option>)}
              </select>
            </label>
          </div>
          {selectedChapter && <div className="flex items-center gap-3 text-xs text-slate-500"><span>版本 {selectedChapter.version}</span><span>{graph.nodes.length} 节点</span><span>{graph.edges.length} 连线</span></div>}
        </div>
      </section>

      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 p-3 sm:p-5">
        <section className="min-h-0 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="grid h-full min-h-0 place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />正在读取故事上下文</span></div>
          ) : error ? (
            <div className="grid h-full min-h-0 place-items-center px-6 text-sm text-red-700">{error}</div>
          ) : selectedProject ? (
            <AgentWorkspace
              key={`${selectedProject.id}:${selectedChapter?.id ?? 'project'}`}
              projectId={selectedProject.id}
              projectTitle={selectedProject.title}
              chapterId={selectedChapter?.id ?? null}
              chapterTitle={selectedChapter?.title ?? null}
              chapterVersion={selectedChapter?.version ?? null}
              selectedNodeId={selectedNodeId}
              graph={graph}
              initialConversationId={searchParams.get('conversation') || ''}
              onConversationChange={updateConversation}
              onApplyGraph={handleAppliedGraph}
              onSelectNode={setSelectedNodeId}
            />
          ) : (
            <div className="grid h-full min-h-0 place-items-center px-6 text-center">
              <div><span className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white"><Bot className="h-5 w-5" /></span><h2 className="mt-4 text-base font-bold">先创建一个故事项目</h2><p className="mt-2 text-sm text-slate-500">创建项目后即可使用项目对话；绑定章节后还可生成可撤销的剧情变更。</p><Link to="/" className="mt-4 inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white">返回项目</Link></div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function chapterToGraph(chapter: Chapter | null | undefined): StoryGraph {
  if (!chapter) return { nodes: [], edges: [] }
  return {
    nodes: chapter.nodes.map((node) => ({ id: node.nodeId, type: node.type as StoryNodeType, position: { x: node.positionX, y: node.positionY }, data: parseNodeData(node.data) })),
    edges: chapter.edges.map((edge) => ({ id: edge.edgeId, source: edge.source, target: edge.target, label: edge.label ?? undefined, sourceHandle: edge.sourceHandle ?? undefined, animated: edge.animated })),
  }
}

function graphToChapter(chapter: Chapter, result: AppliedPatchDto): Chapter {
  return {
    ...chapter,
    version: result.version,
    nodes: result.graph.nodes.map((node) => ({ id: node.id, nodeId: node.id, type: node.type, positionX: node.position.x, positionY: node.position.y, data: JSON.stringify(node.data) })),
    edges: result.graph.edges.map((edge) => ({ id: edge.id, edgeId: edge.id, source: edge.source, target: edge.target, label: edge.label ?? null, sourceHandle: edge.sourceHandle ?? null, animated: edge.animated })),
  }
}

function parseNodeData(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}
