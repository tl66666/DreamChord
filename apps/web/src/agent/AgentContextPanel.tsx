import { useState } from 'react'
import { BookOpen, Boxes, Brain, FileClock, Wrench } from 'lucide-react'
import MemoryCenter from './MemoryCenter'

export default function AgentContextPanel({ projectId, conversationId, projectTitle, chapterTitle, chapterVersion, nodeCount, edgeCount }: {
  projectId: string
  conversationId?: string
  projectTitle: string
  chapterTitle: string
  chapterVersion: number
  nodeCount: number
  edgeCount: number
}) {
  const [view, setView] = useState<'context' | 'memory'>('context')
  return (
    <aside aria-label="Agent 上下文" className="flex min-h-0 flex-col border-l border-slate-200 bg-slate-50/80">
      <header className="border-b border-slate-200 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase text-cyan-700">Active context</p>
        <h2 className="mt-1 truncate text-sm font-semibold text-slate-950">{projectTitle}</h2>
        <p className="mt-1 truncate text-xs text-slate-500">{chapterTitle} · 版本 {chapterVersion}</p>
      </header>
      <div className="grid grid-cols-2 border-b border-slate-200 bg-white p-1">
        <button type="button" onClick={() => setView('context')} className={`flex h-8 items-center justify-center gap-1.5 text-xs ${view === 'context' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}><BookOpen className="h-3.5 w-3.5" />上下文</button>
        <button type="button" onClick={() => setView('memory')} className={`flex h-8 items-center justify-center gap-1.5 text-xs ${view === 'memory' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}><Brain className="h-3.5 w-3.5" />记忆</button>
      </div>
      {view === 'memory' ? <MemoryCenter projectId={projectId} conversationId={conversationId} /> : <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-800"><Boxes className="h-3.5 w-3.5 text-cyan-700" />章节结构</h3>
          <dl className="mt-3 grid grid-cols-2 border border-slate-200 bg-white">
            <div className="border-r border-slate-200 p-3"><dt className="text-[10px] text-slate-500">节点</dt><dd className="mt-1 font-mono text-lg font-semibold text-slate-900">{nodeCount}</dd></div>
            <div className="p-3"><dt className="text-[10px] text-slate-500">连线</dt><dd className="mt-1 font-mono text-lg font-semibold text-slate-900">{edgeCount}</dd></div>
          </dl>
        </section>
        <section className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-800"><BookOpen className="h-3.5 w-3.5 text-cyan-700" />上下文优先级</h3>
          <ol className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
            <li>1. 当前任务与选中范围</li><li>2. 故事圣经与固定约束</li><li>3. 当前对话最近消息</li><li>4. 相关项目记忆与产物</li>
          </ol>
        </section>
        <section className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-800"><Wrench className="h-3.5 w-3.5 text-cyan-700" />工具策略</h3>
          <p className="mt-2 text-xs leading-5 text-slate-600">最多 8 步。读取和体检可直接执行；剧情与素材变更必须生成产物并等待确认。</p>
        </section>
        <section className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-800"><FileClock className="h-3.5 w-3.5 text-cyan-700" />运行记录</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">工具来源和变更产物会随消息显示。不会展示或保存隐藏推理。</p>
        </section>
      </div>}
    </aside>
  )
}
