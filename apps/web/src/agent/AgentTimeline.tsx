import { AlertTriangle, Check, Circle, Loader2, ShieldCheck, Wrench } from 'lucide-react'
import type { AgentRunDto } from './agentTypes'

const statusLabels: Record<string, string> = {
  queued: '任务已排队', planning: '正在制定计划', gathering_context: '正在读取项目', drafting: '正在生成草案',
  validating: '正在校验结构', applying: '正在应用变更', completed: '任务已完成', failed: '任务未完成', cancelled: '任务已取消',
}

const eventLabels: Record<string, string> = {
  format_repair: '正在适配模型返回格式',
  tool_input_repair: '正在修正工具参数',
  response_fallback: '已转为安全对话答复',
  tool_started: '正在调用工具',
  tool_completed: '工具调用已完成',
}

const toolLabels: Record<string, string> = {
  inspect_asset: '检查素材', analyze_story_graph: '检查剧情结构', search_memories: '搜索记忆',
  get_project_characters: '读取角色', get_project_assets: '读取素材', get_chapter_graph: '读取章节',
  prepare_character_asset: '准备立绘', prepare_cg_asset: '准备 CG', prepare_background_asset: '准备背景',
}

function eventText(item: AgentRunDto['timeline'][number]): string {
  const label = eventLabels[item.type || ''] || '记录 Agent 步骤'
  return item.tool ? `${label}：${toolLabels[item.tool] || '受限工具'}` : label
}

export default function AgentTimeline({ run }: { run: AgentRunDto }) {
  const active = !['completed', 'failed', 'cancelled', 'awaiting_approval'].includes(run.status)
  const StatusIcon = active ? Loader2 : run.status === 'failed' ? AlertTriangle : Check
  return (
    <section className="border-b border-slate-200 px-4 py-3" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <StatusIcon className={`h-4 w-4 ${active ? 'animate-spin text-cyan-600' : run.status === 'failed' ? 'text-amber-600' : 'text-emerald-600'}`} />
        {run.status === 'awaiting_approval' ? '草案等待确认' : statusLabels[run.status] || run.status}
      </div>
      {run.status === 'failed' && run.errorMessage && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{run.errorMessage}</p>}
      {run.plan.length > 0 && <ol className="mt-3 space-y-2">{run.plan.map((step, index) => <li key={`${index}-${step}`} className="flex gap-2 text-xs leading-5 text-slate-600"><Circle className="mt-1 h-2.5 w-2.5 shrink-0 fill-slate-200 text-slate-300" />{step}</li>)}</ol>}
      {run.timeline.length > 0 && <div className="mt-3 border-t border-slate-100 pt-2">{run.timeline.slice(-5).map((item, index) => { const Icon = item.type === 'response_fallback' ? ShieldCheck : Wrench; return <div key={`${item.at || index}-${item.tool || item.type}`} className="flex items-center gap-2 py-1 text-[11px] text-slate-500"><Icon className="h-3 w-3 text-cyan-600" />{eventText(item)}</div> })}</div>}
    </section>
  )
}
