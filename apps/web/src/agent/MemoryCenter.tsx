import { useCallback, useEffect, useMemo, useState } from 'react'
import { Brain, Check, Pin, Plus, Search, Trash2, X } from 'lucide-react'
import { createAgentMemory, forgetAgentMemory, getAgentMemories, updateAgentMemory } from '../api/client'
import { useConfirm, useToast } from '../components/FeedbackProvider'
import type { AgentMemoryDto, AgentMemoryInput, AgentMemoryKind } from './agentTypes'

const kinds: Array<{ value: AgentMemoryKind; label: string }> = [
  { value: 'canon', label: '设定' }, { value: 'character', label: '人物' }, { value: 'plot', label: '剧情' },
  { value: 'decision', label: '决策' }, { value: 'preference', label: '偏好' }, { value: 'artifact', label: '变更记录' },
]
const sourceLabels: Record<string, string> = { assistant: 'Agent 建议', user: '用户录入', 'story-bible': '故事圣经', editor: '编辑器' }

export default function MemoryCenter({ projectId, conversationId }: { projectId: string; conversationId?: string }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<AgentMemoryDto[]>([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | AgentMemoryKind>('all')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [newKind, setNewKind] = useState<AgentMemoryKind>('canon')
  const [importance, setImportance] = useState(70)

  const load = useCallback(async () => {
    try { setItems(await getAgentMemories(projectId, conversationId)) } catch { toast.error('记忆加载失败') }
  }, [conversationId, projectId, toast])
  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => items.filter((item) => {
    if (item.kind === 'artifact') return false
    const matchesKind = kind === 'all' || item.kind === kind
    const needle = query.trim().toLocaleLowerCase()
    return matchesKind && (!needle || `${item.title} ${item.content} ${item.tags.join(' ')}`.toLocaleLowerCase().includes(needle))
  }), [items, kind, query])

  const patch = async (item: AgentMemoryDto, value: Partial<Omit<AgentMemoryInput, 'conversationId'>>) => {
    try { const updated = await updateAgentMemory(item.id, value); setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry)) }
    catch { toast.error('记忆更新失败') }
  }
  const forget = async (item: AgentMemoryDto) => {
    if (!await confirm({ title: '遗忘记忆', message: `让 Agent 不再使用「${item.title}」？记录仍会保留用于审计。`, danger: true, confirmText: '遗忘' })) return
    try { await forgetAgentMemory(item.id); setItems((current) => current.filter((entry) => entry.id !== item.id)); toast.success('已遗忘') } catch { toast.error('遗忘失败') }
  }
  const create = async () => {
    if (!title.trim() || !content.trim()) { toast.info('请填写标题和内容'); return }
    try {
      const created = await createAgentMemory(projectId, { kind: newKind, title: title.trim(), content: content.trim(), importance, status: 'active', sourceType: 'user' })
      setItems((current) => [created, ...current]); setTitle(''); setContent(''); setShowForm(false); toast.success('记忆已保存')
    } catch { toast.error('记忆保存失败') }
  }

  return (
    <section aria-label="记忆中心" className="flex min-h-0 flex-1 flex-col bg-slate-50/80">
      <div className="flex items-center gap-2 border-b border-slate-200 p-3">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><input aria-label="搜索记忆" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索记忆" className="h-9 w-full border border-slate-200 bg-white pl-8 pr-2 text-xs outline-none focus:border-cyan-600" /></div>
        <button type="button" aria-label="添加记忆" title="添加记忆" onClick={() => setShowForm(true)} className="flex h-9 w-9 shrink-0 items-center justify-center bg-slate-950 text-white"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2">
        <button type="button" onClick={() => setKind('all')} className={`h-7 shrink-0 px-2 text-[11px] ${kind === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>全部</button>
        {kinds.map((item) => <button key={item.value} type="button" onClick={() => setKind(item.value)} className={`h-7 shrink-0 px-2 text-[11px] ${kind === item.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>{item.label}</button>)}
      </div>
      {showForm && <div className="border-b border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-900">新建项目记忆</h3><button type="button" aria-label="关闭" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></button></div>
        <div className="mt-3 grid grid-cols-[1fr_90px] gap-2"><input aria-label="记忆标题" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题" className="h-9 border border-slate-200 px-2 text-xs" /><select aria-label="记忆类型" value={newKind} onChange={(event) => setNewKind(event.target.value as AgentMemoryKind)} className="h-9 border border-slate-200 bg-white px-2 text-xs">{kinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <textarea aria-label="记忆内容" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Agent 应长期记住的事实或偏好" rows={3} className="mt-2 w-full resize-none border border-slate-200 p-2 text-xs" />
        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">重要度 <input aria-label="重要度" type="range" min="0" max="100" value={importance} onChange={(event) => setImportance(Number(event.target.value))} className="min-w-0 flex-1" /><span className="w-7 text-right font-mono">{importance}</span></label>
        <button type="button" aria-label="保存记忆" onClick={() => void create()} className="mt-3 h-8 w-full bg-cyan-700 text-xs font-medium text-white">保存记忆</button>
      </div>}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {visible.map((item) => <article key={item.id} className="border border-slate-200 bg-white p-3">
          <div className="flex items-start gap-2"><Brain className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-xs font-semibold text-slate-900">{item.title}</h3>{item.isPinned && <Pin className="h-3 w-3 shrink-0 fill-cyan-700 text-cyan-700" />}</div><p className="mt-1 text-[10px] text-slate-500">{kinds.find((entry) => entry.value === item.kind)?.label} · <span>{sourceLabels[item.sourceType] ?? item.sourceType}</span> · 重要度 {item.importance}</p></div></div>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{item.content}</p>
          {item.tags.length > 0 && <p className="mt-2 truncate text-[10px] text-cyan-700">{item.tags.map((tag) => `#${tag}`).join(' ')}</p>}
          <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
            {item.status === 'suggested' && <button type="button" aria-label="确认记忆" title="确认记忆" onClick={() => void patch(item, { status: 'active' })} className="flex h-7 items-center gap-1 px-2 text-[11px] text-emerald-700 hover:bg-emerald-50"><Check className="h-3.5 w-3.5" />确认</button>}
            <button type="button" aria-label="固定记忆" title="固定记忆" onClick={() => void patch(item, { isPinned: !item.isPinned })} className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100"><Pin className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="遗忘记忆" title="遗忘记忆" onClick={() => void forget(item)} className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </article>)}
        {visible.length === 0 && <div className="px-4 py-12 text-center"><Brain className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-xs text-slate-500">还没有保存长期设定</p><p className="mt-1 text-[11px] leading-5 text-slate-400">适合保存角色关系、世界观规则和创作偏好。</p></div>}
      </div>
    </section>
  )
}
