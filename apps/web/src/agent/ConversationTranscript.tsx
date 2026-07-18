import { useLayoutEffect, useRef, useState } from 'react'
import { Bot, ChevronUp, FileImage, GitBranch, MessageSquareText, UserRound } from 'lucide-react'
import type { AgentConversationDto, AgentMessageDto } from './agentTypes'

export default function ConversationTranscript({ conversation, messages, loading, hasMore, onLoadMore, onDraftAction, onDraftEdit, children }: {
  conversation: AgentConversationDto | null
  messages: AgentMessageDto[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onDraftAction: (request: { prompt: string; scope: 'chapter'; draft: string }) => void
  onDraftEdit?: (messageId: string, content: string) => Promise<void>
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const followsNewest = useRef(true)
  const lastConversationId = useRef<string | null>(null)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [editedDraft, setEditedDraft] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)

  useLayoutEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const conversationChanged = lastConversationId.current !== conversation?.id
    lastConversationId.current = conversation?.id ?? null
    if (!conversationChanged && !followsNewest.current) return
    if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'auto' })
    else scroller.scrollTop = scroller.scrollHeight
  }, [conversation?.id, messages.length])

  return (
    <section aria-label="对话内容" className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <header className="flex min-h-14 items-center justify-between border-b border-slate-200 px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-950">{conversation?.title || '选择一个对话'}</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">消息、工具与创作产物会保存在当前对话</p>
        </div>
        <MessageSquareText className="h-4 w-4 shrink-0 text-cyan-700" />
      </header>
      <div ref={scrollRef} onScroll={(event) => {
        const element = event.currentTarget
        followsNewest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80
      }} className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(to_bottom,#f8fafc_1px,transparent_1px)] bg-[length:100%_32px] px-4 py-5 sm:px-6">
        {hasMore && <button type="button" onClick={onLoadMore} className="mx-auto mb-4 flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"><ChevronUp className="h-3.5 w-3.5" />加载更早消息</button>}
        {loading && messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">正在读取对话...</p>}
        {!loading && conversation && messages.length === 0 && <div className="mx-auto max-w-md py-14 text-center"><Bot className="mx-auto h-6 w-6 text-cyan-700" /><h3 className="mt-3 text-sm font-semibold text-slate-900">从一个具体任务开始</h3><p className="mt-2 text-xs leading-5 text-slate-500">例如续写当前场景、检查人物动机，或为一个选择补出真正不同的后果。</p></div>}
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.map((message) => {
            const user = message.role === 'user'
            const Icon = user ? UserRound : Bot
            return (
              <article key={message.id} className={`flex gap-3 ${user ? 'justify-end' : 'justify-start'}`}>
                {!user && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-950 text-white"><Icon className="h-4 w-4" /></span>}
                <div className={`max-w-[82%] border px-4 py-3 text-sm leading-6 ${user ? 'border-cyan-200 bg-cyan-50 text-slate-900' : 'border-slate-200 bg-white text-slate-800 shadow-sm'}`}>
                  {editingDraftId === message.id ? <div className="space-y-2"><label className="sr-only" htmlFor={`draft-${message.id}`}>草稿正文</label><textarea id={`draft-${message.id}`} aria-label="草稿正文" value={editedDraft} onChange={(event) => setEditedDraft(event.target.value)} rows={8} className="w-full resize-y border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none focus:border-dream-500" /><div className="flex gap-2"><button type="button" aria-label="取消编辑草稿" onClick={() => setEditingDraftId(null)} className="border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">取消</button><button type="button" aria-label="保存草稿" disabled={savingDraft || !editedDraft.trim()} onClick={() => { if (!onDraftEdit) return; setSavingDraft(true); void onDraftEdit(message.id, editedDraft).finally(() => { setSavingDraft(false); setEditingDraftId(null) }) }} className="bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50">保存草稿</button></div></div> : <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                  {!user && isCreativeDraft(message.content) && editingDraftId !== message.id && <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                    <button type="button" onClick={() => onDraftAction({ scope: 'chapter', draft: message.content, prompt: '根据用户选择的续写草稿，创建可编辑的工作台场景；把角色台词拆成对话卡、叙述拆成旁白卡，只复用与草稿匹配的素材，并生成可审批补丁。' })} className="rounded-md bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800">生成工作台场景</button>
                    <button type="button" onClick={() => onDraftAction({ scope: 'chapter', draft: message.content, prompt: '基于用户选择的续写草稿继续完善人物动作、台词节奏和剧情推进，并生成可审批的镜头卡。' })} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">继续完善草稿</button>
                    {onDraftEdit && <button type="button" aria-label="编辑草稿" onClick={() => { setEditingDraftId(message.id); setEditedDraft(message.content) }} className="border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">编辑草稿</button>}
                  </div>}
                  <ArtifactRefs metadata={message.metadata} />
                  <time className="mt-2 block text-[10px] text-slate-400">{formatMessageTime(message.createdAt)}</time>
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <div className="max-h-[48%] shrink-0 overflow-y-auto border-t border-slate-200 bg-white">{children}</div>
    </section>
  )
}

function isCreativeDraft(content: string): boolean {
  const value = content.trim()
  if (/^```(?:json)?\b/i.test(value) || /^\{\s*"(?:type|suggestions|plan|patch)"/i.test(value)) return false
  if (/(?:已将续写(?:整理|保存)|已基于素材|可运行场景草案|尚未写入章节|确认后会在工作台|等待用户确认写入)/.test(value)) return false
  return /(?:【草稿结束】|【旁白】|【地点】|【画面】|【选项】|(?:^|\n)\s*(?:\*\*)?[^\n：:]{1,30}(?:\*\*)?\s*[：:])/.test(value)
}

function ArtifactRefs({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== 'object' || !('artifactRefs' in metadata) || !Array.isArray(metadata.artifactRefs)) return null
  const refs = metadata.artifactRefs.filter((item): item is { type: 'story-patch' | 'asset-variant'; id: string } => Boolean(item && typeof item === 'object' && 'type' in item && 'id' in item))
  if (refs.length === 0) return null
  return <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">{refs.map((item) => { const Icon = item.type === 'asset-variant' ? FileImage : GitBranch; return <span key={`${item.type}:${item.id}`} className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 text-[10px] text-slate-600"><Icon className="h-3 w-3" />{item.type === 'asset-variant' ? '待审素材' : '剧情补丁'} · {item.id.slice(0, 8)}</span> })}</div>
}

function formatMessageTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
