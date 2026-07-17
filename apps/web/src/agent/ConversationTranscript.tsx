import { Bot, ChevronUp, FileImage, GitBranch, MessageSquareText, UserRound } from 'lucide-react'
import type { AgentConversationDto, AgentMessageDto } from './agentTypes'

export default function ConversationTranscript({ conversation, messages, loading, hasMore, onLoadMore, children }: {
  conversation: AgentConversationDto | null
  messages: AgentMessageDto[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  children: React.ReactNode
}) {
  return (
    <section aria-label="对话内容" className="flex min-h-0 min-w-0 flex-col bg-white">
      <header className="flex min-h-14 items-center justify-between border-b border-slate-200 px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-950">{conversation?.title || '选择一个对话'}</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">消息、工具与创作产物会保存在当前对话</p>
        </div>
        <MessageSquareText className="h-4 w-4 shrink-0 text-cyan-700" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(to_bottom,#f8fafc_1px,transparent_1px)] bg-[length:100%_32px] px-4 py-5 sm:px-6">
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
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  <ArtifactRefs metadata={message.metadata} />
                  <time className="mt-2 block text-[10px] text-slate-400">{formatMessageTime(message.createdAt)}</time>
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-white">{children}</div>
    </section>
  )
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
