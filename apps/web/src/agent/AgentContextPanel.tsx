import { useState } from 'react'
import { BookOpen, Boxes, Brain } from 'lucide-react'
import MemoryCenter from './MemoryCenter'

export default function AgentContextPanel({ projectId, conversationId, projectTitle, chapterTitle, chapterVersion, nodeCount, edgeCount }: {
  projectId: string
  conversationId?: string
  projectTitle: string
  chapterTitle: string | null
  chapterVersion: number | null
  nodeCount: number
  edgeCount: number
}) {
  const [view, setView] = useState<'context' | 'memory'>('context')
  return (
    <aside aria-label="Agent 上下文" className="flex min-h-0 flex-col border-l border-slate-200 bg-slate-50/80">
      <header className="border-b border-slate-200 px-4 py-4">
        <p className="text-[10px] font-semibold text-cyan-700">创作参考</p>
        <h2 className="mt-1 truncate text-sm font-semibold text-slate-950">{projectTitle}</h2>
        <p className="mt-1 truncate text-xs text-slate-500">{chapterTitle ? `${chapterTitle} · 版本 ${chapterVersion}` : '项目对话 · 未绑定章节'}</p>
      </header>
      <div className="grid grid-cols-2 border-b border-slate-200 bg-white p-1">
        <button type="button" onClick={() => setView('context')} className={`flex h-8 items-center justify-center gap-1.5 text-xs ${view === 'context' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}><BookOpen className="h-3.5 w-3.5" />故事资料</button>
        <button type="button" onClick={() => setView('memory')} className={`flex h-8 items-center justify-center gap-1.5 text-xs ${view === 'memory' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}><Brain className="h-3.5 w-3.5" />长期设定</button>
      </div>
      {view === 'memory' ? <MemoryCenter projectId={projectId} conversationId={conversationId} /> : <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-800"><Boxes className="h-3.5 w-3.5 text-cyan-700" />{chapterTitle ? '章节结构' : '项目上下文'}</h3>
          <dl className="mt-3 grid grid-cols-2 border border-slate-200 bg-white">
            <div className="border-r border-slate-200 p-3"><dt className="text-[10px] text-slate-500">{chapterTitle ? '节点' : '范围'}</dt><dd className="mt-1 font-mono text-lg font-semibold text-slate-900">{chapterTitle ? nodeCount : '全局'}</dd></div>
            <div className="p-3"><dt className="text-[10px] text-slate-500">{chapterTitle ? '连线' : '写入'}</dt><dd className="mt-1 font-mono text-lg font-semibold text-slate-900">{chapterTitle ? edgeCount : '只读'}</dd></div>
          </dl>
        </section>
        <section className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-800"><BookOpen className="h-3.5 w-3.5 text-cyan-700" />Agent 会参考</h3>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
            <li>当前章节、已选镜头与故事圣经</li><li>这段对话中的草稿和你的修改</li><li>你确认保存的角色、剧情和偏好设定</li>
          </ul>
          <p className="mt-4 text-[11px] leading-5 text-slate-500">涉及剧情、素材或工作台的修改，都会先生成草案，确认后才会写入。</p>
        </section>
      </div>}
    </aside>
  )
}
