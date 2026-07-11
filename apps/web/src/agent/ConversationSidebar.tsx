import { Check, MessageSquarePlus, Pencil, Pin, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AgentConversationDto } from './agentTypes'

export default function ConversationSidebar({ conversations, activeId, busy, onCreate, onSelect, onRename, onPin, onDelete }: {
  conversations: AgentConversationDto[]
  activeId: string
  busy: boolean
  onCreate: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onPin: (conversation: AgentConversationDto) => void
  onDelete: (conversation: AgentConversationDto) => void
}) {
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const filtered = useMemo(() => conversations.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase())), [conversations, query])

  const startRename = (conversation: AgentConversationDto) => {
    setEditingId(conversation.id)
    setDraftTitle(conversation.title)
  }
  const finishRename = () => {
    const title = draftTitle.trim()
    if (editingId && title) onRename(editingId, title)
    setEditingId('')
  }

  return (
    <aside aria-label="Agent 会话" className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-50/80">
      <div className="border-b border-slate-200 p-3">
        <button type="button" aria-label="新建对话" disabled={busy} onClick={onCreate} className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          <MessageSquarePlus className="h-4 w-4" />新建对话
        </button>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <span className="sr-only">搜索对话</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索对话" className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.length === 0 && <p className="px-3 py-8 text-center text-xs leading-5 text-slate-500">还没有对话。新建一个任务，Agent 会记住这条对话里的上下文。</p>}
        <div className="space-y-1">
          {filtered.map((conversation) => {
            const active = conversation.id === activeId
            return (
              <div key={conversation.id} className={`group border-l-2 px-2 py-2 ${active ? 'border-cyan-600 bg-white shadow-sm' : 'border-transparent hover:bg-white/80'}`}>
                {editingId === conversation.id ? (
                  <div className="flex items-center gap-1">
                    <input aria-label="重命名对话" autoFocus value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') finishRename(); if (event.key === 'Escape') setEditingId('') }} className="h-8 min-w-0 flex-1 rounded border border-cyan-400 px-2 text-xs outline-none" />
                    <button type="button" title="保存名称" aria-label="保存名称" onClick={finishRename} className="grid h-8 w-8 place-items-center text-emerald-700"><Check className="h-3.5 w-3.5" /></button>
                    <button type="button" title="取消重命名" aria-label="取消重命名" onClick={() => setEditingId('')} className="grid h-8 w-8 place-items-center text-slate-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => onSelect(conversation.id)} className="block w-full min-w-0 text-left">
                      <span className="flex items-center gap-1.5">
                        {conversation.isPinned && <Pin className="h-3 w-3 shrink-0 fill-cyan-600 text-cyan-600" />}
                        <span className="truncate text-sm font-medium text-slate-800">{conversation.title}</span>
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">{scopeLabel(conversation.scope)} · {formatTime(conversation.updatedAt)}</span>
                    </button>
                    <div className="mt-1 flex items-center justify-end gap-0.5 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 xl:group-focus-within:opacity-100">
                      <button type="button" title={conversation.isPinned ? '取消置顶' : '置顶对话'} aria-label={conversation.isPinned ? '取消置顶' : '置顶对话'} onClick={() => onPin(conversation)} className="grid h-8 w-8 place-items-center text-slate-500 hover:bg-slate-100 hover:text-cyan-700"><Pin className="h-3.5 w-3.5" /></button>
                      <button type="button" title="重命名对话" aria-label="重命名对话" onClick={() => startRename(conversation)} className="grid h-8 w-8 place-items-center text-slate-500 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" title="删除对话" aria-label="删除对话" onClick={() => onDelete(conversation)} className="grid h-8 w-8 place-items-center text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function scopeLabel(scope: string): string {
  return ({ card: '镜头', scene: '场景', chapter: '章节', project: '项目' } as Record<string, string>)[scope] || scope
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
