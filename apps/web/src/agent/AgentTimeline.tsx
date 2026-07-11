import { Check, Circle, Loader2, Wrench } from 'lucide-react'
import type { AgentRunDto } from './agentTypes'

const statusLabels: Record<string, string> = {
  queued: '任务已排队', planning: '正在制定计划', gathering_context: '正在读取项目', drafting: '正在生成草案',
  validating: '正在校验结构', applying: '正在应用变更', completed: '任务已完成', failed: '任务失败', cancelled: '任务已取消',
}

export default function AgentTimeline({ run }: { run: AgentRunDto }) {
  const active = !['completed', 'failed', 'cancelled', 'awaiting_approval'].includes(run.status)
  return (
    <section className="border-b border-slate-200 px-4 py-3" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {active ? <Loader2 className="h-4 w-4 animate-spin text-cyan-600" /> : <Check className="h-4 w-4 text-emerald-600" />}
        {run.status === 'awaiting_approval' ? '草案等待确认' : statusLabels[run.status] || run.status}
      </div>
      {run.plan.length > 0 && <ol className="mt-3 space-y-2">{run.plan.map((step, index) => <li key={`${index}-${step}`} className="flex gap-2 text-xs leading-5 text-slate-600"><Circle className="mt-1 h-2.5 w-2.5 shrink-0 fill-slate-200 text-slate-300" />{step}</li>)}</ol>}
      {run.timeline.length > 0 && <div className="mt-3 border-t border-slate-100 pt-2">{run.timeline.slice(-5).map((item, index) => <div key={`${item.at || index}-${item.tool || item.type}`} className="flex items-center gap-2 py-1 text-[11px] text-slate-500"><Wrench className="h-3 w-3 text-cyan-600" />{item.tool ? `调用 ${item.tool}` : item.type}</div>)}</div>}
    </section>
  )
}
