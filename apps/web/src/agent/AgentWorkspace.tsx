import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessagesSquare, PanelRight, Rows3 } from 'lucide-react'
import type { StoryGraph } from '@dreamchord/story-domain'
import { createAgentConversation, deleteAgentConversation, getAgentConversations, getAgentMessages, updateAgentConversation } from '../api/client'
import { useConfirm, useToast } from '../components/FeedbackProvider'
import AgentPanel from './AgentPanel'
import AgentContextPanel from './AgentContextPanel'
import ConversationSidebar from './ConversationSidebar'
import ConversationTranscript from './ConversationTranscript'
import type { AgentConversationDto, AgentMessageDto, AppliedPatchDto } from './agentTypes'

type Pane = 'conversations' | 'chat' | 'context'

export default function AgentWorkspace({
  projectId, projectTitle, chapterId, chapterTitle, chapterVersion, graph, selectedNodeId, initialConversationId,
  onConversationChange, onApplyGraph, onSelectNode,
}: {
  projectId: string; projectTitle: string; chapterId: string; chapterTitle: string; chapterVersion: number; graph: StoryGraph
  selectedNodeId: string | null; initialConversationId?: string
  onConversationChange: (conversationId: string) => void
  onApplyGraph: (result: AppliedPatchDto) => void; onSelectNode: (nodeId: string) => void
}) {
  const confirm = useConfirm()
  const toast = useToast()
  const [conversations, setConversations] = useState<AgentConversationDto[]>([])
  const [activeId, setActiveId] = useState(initialConversationId || '')
  const [messages, setMessages] = useState<AgentMessageDto[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pane, setPane] = useState<Pane>('chat')

  const activeConversation = useMemo(() => conversations.find((item) => item.id === activeId) ?? null, [activeId, conversations])

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
    if (!conversationId) { setMessages([]); setNextCursor(null); return }
    const page = await getAgentMessages(conversationId, cursor)
    setMessages((current) => cursor ? [...page.items, ...current] : page.items)
    setNextCursor(page.nextCursor)
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
    }).catch(() => alive && toast.error('会话加载失败')).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [initialConversationId, onConversationChange, projectId, toast])

  useEffect(() => {
    void loadMessages(activeId)
    if (!activeId) return
    const timer = window.setInterval(() => { void loadMessages(activeId) }, 3000)
    return () => window.clearInterval(timer)
  }, [activeId, loadMessages])

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
      const created = await createAgentConversation(projectId, { title: '新对话', scope: 'chapter', chapterId })
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

  const panelClass = (target: Pane, desktop: string) => `${pane === target ? 'flex' : 'hidden'} ${desktop} min-h-0 flex-col`

  return (
    <div className="flex h-full min-h-[680px] flex-col bg-white">
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
          <ConversationTranscript conversation={activeConversation} messages={messages} loading={loading} hasMore={Boolean(nextCursor)} onLoadMore={() => nextCursor && void loadMessages(activeId, nextCursor)}>
            {activeId ? <AgentPanel projectId={projectId} chapterId={chapterId} chapterVersion={chapterVersion} selectedNodeId={selectedNodeId} selectedSceneId={null} graph={graph} initialConversationId={activeId} onConversationChange={selectConversation} onApplyGraph={onApplyGraph} onSelectNode={onSelectNode} compact /> : <div className="p-4 text-center text-sm text-slate-500"><button type="button" aria-label="新建对话" onClick={() => void createConversation()} className="rounded-md bg-slate-950 px-4 py-2 text-white">新建对话</button></div>}
          </ConversationTranscript>
        </div>
        <div className={panelClass('context', 'xl:flex')}>
          <AgentContextPanel projectTitle={projectTitle} chapterTitle={chapterTitle} chapterVersion={chapterVersion} nodeCount={graph.nodes.length} edgeCount={graph.edges.length} />
        </div>
      </div>
    </div>
  )
}
