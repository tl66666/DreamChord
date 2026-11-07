import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpenCheck, MessagesSquare, PanelRight, Rows3, X } from 'lucide-react'
import type { StoryGraph } from '@dreamchord/story-domain'
import { createAgentConversation, deleteAgentConversation, getAgentConversations, getAgentMessages, updateAgentConversation, updateAgentMessage } from '../api/client'
import { useConfirm, useToast } from '../components/FeedbackProvider'
import AgentPanel from './AgentPanel'
import AgentContextPanel from './AgentContextPanel'
import ConversationSidebar from './ConversationSidebar'
import ConversationTranscript from './ConversationTranscript'
import type { AgentConversationDto, AgentMessageDto, AgentScope, AppliedPatchDto } from './agentTypes'

type Pane = 'conversations' | 'chat' | 'context'

export default function AgentWorkspace({
  projectId, projectTitle, chapterId, chapterTitle, chapterVersion, graph, selectedNodeId, selectedSceneId, initialConversationId,
  onConversationChange, onApplyGraph, onSelectNode, taskRequest, embeddedInEditor = false, onClose, getGraphMutationBlockedReason,
}: {
  projectId: string; projectTitle: string; chapterId: string | null; chapterTitle: string | null; chapterVersion: number | null; graph: StoryGraph
  selectedNodeId: string | null; selectedSceneId?: string | null; initialConversationId?: string
  onConversationChange: (conversationId: string) => void
  onApplyGraph: (result: AppliedPatchDto) => void; onSelectNode: (nodeId: string) => void
  taskRequest?: { id: number; prompt: string; scope: import('./agentTypes').AgentScope }
  embeddedInEditor?: boolean; onClose?: () => void
  getGraphMutationBlockedReason?: () => string | undefined
}) {
  const confirm = useConfirm()
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [conversations, setConversations] = useState<AgentConversationDto[]>([])
  const [activeId, setActiveId] = useState(initialConversationId || '')
  const [messages, setMessages] = useState<AgentMessageDto[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pane, setPane] = useState<Pane>('chat')
  const [draftTask, setDraftTask] = useState<{ id: number; conversationId: string; prompt: string; scope: AgentScope; draft: string; autoRun: boolean } | null>(null)
  const [consumedTasks, setConsumedTasks] = useState(() => new Set<number>())
  const messageSession = useRef<{ conversationId: string; alive: boolean; refresh: number; history: number; hasHistory: boolean } | null>(null)

  const activeConversation = useMemo(() => conversations.find((item) => item.id === activeId) ?? null, [activeId, conversations])
  const candidateTask = draftTask ? draftTask.conversationId === activeId ? draftTask : undefined : taskRequest
  const effectiveTaskRequest = candidateTask && !consumedTasks.has(candidateTask.id) ? candidateTask : undefined

  const loadConversations = useCallback(async (preferredId?: string) => {
    const items = await getAgentConversations(projectId)
    setConversations(items)
    const nextId = preferredId && items.some((item) => item.id === preferredId)
      ? preferredId
      : activeId && items.some((item) => item.id === activeId) ? activeId : items[0]?.id || ''
    setActiveId(nextId)
    if (nextId) onConversationChange(nextId)
  }, [activeId, onConversationChange, projectId])

  const loadMessages = useCallback(async (conversationId: string, cursor?: string) => {
    const session = messageSession.current
    if (!conversationId || !session?.alive || session.conversationId !== conversationId) return
    const lane = cursor ? 'history' : 'refresh'
    const request = ++session[lane]
    try {
      const page = await getAgentMessages(conversationId, cursor)
      if (!session.alive || messageSession.current !== session || request !== session[lane]) return
      setMessages((current) => {
        const incomingIds = new Set(page.items.map((item) => item.id))
        if (cursor) {
          const currentIds = new Set(current.map((item) => item.id))
          return [...page.items.filter((item) => !currentIds.has(item.id)), ...current]
        }
        return [...current.filter((item) => !incomingIds.has(item.id)), ...page.items]
      })
      if (cursor) session.hasHistory = true
      if (cursor || !session.hasHistory) setNextCursor(page.nextCursor)
    } catch {
      if (session.alive && messageSession.current === session && request === session[lane]) toastRef.current.error('消息加载失败，请重试')
    }
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    getAgentConversations(projectId).then((items) => {
      if (!alive) return
      setConversations(items)
      const selected = (initialConversationId && items.some((item) => item.id === initialConversationId) ? initialConversationId : items[0]?.id) || ''
      setActiveId(selected)
      if (selected) onConversationChange(selected)
    }).catch(() => alive && toastRef.current.error('会话加载失败')).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [initialConversationId, onConversationChange, projectId])

  useEffect(() => {
    const session = { conversationId: activeId, alive: true, refresh: 0, history: 0, hasHistory: false }
    messageSession.current = session
    setMessages([])
    setNextCursor(null)
    let refreshing = false
    const refresh = () => {
      // Slow responses must finish before another poll can supersede them.
      if (!session.alive || refreshing) return
      refreshing = true
      void loadMessages(activeId).finally(() => { refreshing = false })
    }
    refresh()
    const timer = activeId ? window.setInterval(refresh, 3000) : undefined
    return () => { session.alive = false; window.clearInterval(timer) }
  }, [activeId, loadMessages])

  useEffect(() => {
    if (!embeddedInEditor || !onClose) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [embeddedInEditor, onClose])

  const selectConversation = (id: string) => {
    setActiveId(id)
    setMessages([])
    setNextCursor(null)
    setPane('chat')
    onConversationChange(id)
  }

  const createConversation = async () => {
    setBusy(true)
    try {
      const created = await createAgentConversation(projectId, chapterId
        ? { title: '新对话', scope: 'chapter', chapterId }
        : { title: '新对话', scope: 'project' })
      await loadConversations(created.id)
      selectConversation(created.id)
    } catch { toast.error('新建对话失败') } finally { setBusy(false) }
  }

  const renameConversation = async (id: string, title: string) => {
    try { const updated = await updateAgentConversation(id, { title }); setConversations((items) => items.map((item) => item.id === id ? updated : item)) }
    catch { toast.error('重命名失败') }
  }

  const pinConversation = async (conversation: AgentConversationDto) => {
    try { await updateAgentConversation(conversation.id, { isPinned: !conversation.isPinned }); await loadConversations(conversation.id) }
    catch { toast.error('置顶操作失败') }
  }

  const removeConversation = async (conversation: AgentConversationDto) => {
    if (!await confirm({ title: '删除对话', message: `确定删除「${conversation.title}」吗？聊天消息会删除，已应用的剧情变更仍会保留。`, danger: true, confirmText: '删除' })) return
    try { await deleteAgentConversation(conversation.id); await loadConversations(); toast.success('对话已删除') }
    catch { toast.error('删除对话失败') }
  }

  const saveDraft = async (messageId: string, content: string) => {
    const session = messageSession.current
    try {
      const updated = await updateAgentMessage(activeId, messageId, content)
      if (session?.alive && messageSession.current === session) {
        // A poll started before the save must not restore its stale message text.
        session.refresh += 1
        setMessages((items) => items.map((item) => item.id === messageId ? updated : item))
      }
    } catch (error) { toast.error('草稿保存失败'); throw error }
  }

  const panelClass = (target: Pane, desktop: string) => `${pane === target ? 'flex' : 'hidden'} ${desktop} min-h-0 flex-col`

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-white">
      {embeddedInEditor && <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-950 text-white"><BookOpenCheck className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-slate-950">创作 Agent</h1>
            <p className="truncate text-[11px] text-slate-500">编辑器模式 · {chapterId ? `已绑定：${chapterTitle || '当前章节'}` : '项目对话'}</p>
          </div>
        </div>
        {onClose && <button type="button" aria-label="关闭 Agent" title="关闭 Agent（Esc）" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"><X className="h-4 w-4" /></button>}
      </header>}
      <nav aria-label="Agent 工作区视图" className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 p-1 xl:hidden">
        {([{ id: 'conversations', label: '对话', icon: MessagesSquare }, { id: 'chat', label: '工作区', icon: Rows3 }, { id: 'context', label: '上下文', icon: PanelRight }] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setPane(id)} className={`flex h-10 items-center justify-center gap-1.5 text-xs font-medium ${pane === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}><Icon className="h-3.5 w-3.5" />{label}</button>
        ))}
      </nav>
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <div className={panelClass('conversations', 'xl:flex')}>
          <ConversationSidebar conversations={conversations} activeId={activeId} busy={busy} onCreate={() => void createConversation()} onSelect={selectConversation} onRename={(id, title) => void renameConversation(id, title)} onPin={(item) => void pinConversation(item)} onDelete={(item) => void removeConversation(item)} />
        </div>
        <div className={panelClass('chat', 'xl:flex')}>
          <ConversationTranscript key={activeId} conversation={activeConversation} messages={messages} loading={loading} hasMore={Boolean(nextCursor)} onLoadMore={() => nextCursor && void loadMessages(activeId, nextCursor)} onDraftAction={(request) => setDraftTask({ ...request, conversationId: activeId, id: Date.now(), autoRun: true })} onDraftEdit={saveDraft}>
            {activeId ? <AgentPanel key={`${projectId}:${chapterId}:${activeId}`} projectId={projectId} chapterId={chapterId} chapterVersion={chapterVersion} selectedNodeId={selectedNodeId} selectedSceneId={selectedSceneId ?? null} graph={graph} getGraphMutationBlockedReason={getGraphMutationBlockedReason} taskRequest={effectiveTaskRequest} onTaskConsumed={(id) => { setConsumedTasks((current) => new Set([...current, id])); setDraftTask(null) }} initialConversationId={activeId} onConversationChange={selectConversation} onApplyGraph={onApplyGraph} onSelectNode={onSelectNode} compact /> : <div className="p-4 text-center text-sm text-slate-500"><button type="button" aria-label="新建对话" onClick={() => void createConversation()} className="rounded-md bg-slate-950 px-4 py-2 text-white">新建对话</button></div>}
          </ConversationTranscript>
        </div>
        <div className={panelClass('context', 'xl:flex')}>
          <AgentContextPanel projectId={projectId} conversationId={activeId || undefined} projectTitle={projectTitle} chapterTitle={chapterTitle} chapterVersion={chapterVersion} nodeCount={graph.nodes.length} edgeCount={graph.edges.length} />
        </div>
      </div>
    </div>
  )
}
