import { BookOpen, GitBranch, Image as ImageIcon, MessageSquareText, Play, ScanSearch, Users, WandSparkles } from 'lucide-react'
import type { AgentScope } from './agentTypes'

const scopes: Array<{ value: AgentScope; label: string }> = [
  { value: 'card', label: '当前镜头' }, { value: 'scene', label: '当前场景' },
  { value: 'chapter', label: '当前章节' }, { value: 'project', label: '全项目' },
]
const shortcuts = [
  { label: '润色当前', icon: WandSparkles, prompt: '润色当前镜头，保持角色语言习惯和原意。', scope: 'card' as const },
  { label: '续写场景', icon: MessageSquareText, prompt: '承接当前场景续写一组有推进作用的镜头。', scope: 'scene' as const },
  { label: '补充分支', icon: GitBranch, prompt: '检查当前章节的选择节点，并补充一个有实质差异的合理分支。', scope: 'chapter' as const },
]
const starters = [
  { label: '了解项目', icon: BookOpen, prompt: '概括整个项目，并告诉我现在最值得先完善什么。', scope: 'project' as const },
  { label: '检查剧情', icon: ScanSearch, prompt: '检查当前故事的剧情结构、断路和薄弱环节，并按优先级说明。', scope: 'project' as const },
  { label: '梳理角色', icon: Users, prompt: '梳理项目角色的目标、关系和可能缺失的设定。', scope: 'project' as const },
  { label: '素材建议', icon: ImageIcon, prompt: '盘点全局素材，并建议还需要准备哪些背景、CG 或角色立绘。', scope: 'project' as const },
]

export default function AgentComposer({ prompt, scope, disabled, hasProvider, hasChapter = true, onPromptChange, onScopeChange, onRun, onHealth, onOpenSettings }: {
  prompt: string; scope: AgentScope; disabled: boolean; hasProvider: boolean; hasChapter?: boolean
  onPromptChange: (value: string) => void; onScopeChange: (scope: AgentScope) => void; onRun: () => void; onHealth: () => void; onOpenSettings: () => void
}) {
  return (
    <div className="space-y-3 border-b border-slate-200 p-4">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-slate-500">直接问 Agent</p>
        <div className="grid grid-cols-2 gap-1.5">
          {starters.map(({ label, icon: Icon, prompt: value, scope: nextScope }) => <button key={label} type="button" aria-label={label} onClick={() => { onPromptChange(value); onScopeChange(nextScope) }} className="flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left text-[11px] font-medium text-slate-700 hover:border-cyan-200 hover:bg-cyan-50"><Icon className="h-3.5 w-3.5 shrink-0 text-cyan-700" />{label}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" aria-label="Agent 作用域">
        {scopes.map((item) => {
          const unavailable = !hasChapter && item.value !== 'project'
          return <button key={item.value} type="button" disabled={unavailable} title={unavailable ? '绑定章节后可用' : undefined} onClick={() => onScopeChange(item.value)} className={`min-h-9 rounded-md px-2 text-xs font-medium transition ${scope === item.value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'} disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:text-slate-300`}>{item.label}</button>
        })}
      </div>
      <label className="block">
        <span className="sr-only">创作任务</span>
        <textarea aria-label="创作任务" value={prompt} onChange={(event) => onPromptChange(event.target.value)} rows={5} placeholder="直接聊天，或描述你想检查、续写、修改的内容…" className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-dream-500 focus:ring-2 focus:ring-dream-500/15" />
      </label>
      <div className="grid grid-cols-3 gap-1.5">
        {shortcuts.map(({ label, icon: Icon, prompt: value, scope: nextScope }) => <button key={label} type="button" title={!hasChapter ? '绑定章节后可用' : label} disabled={!hasChapter} onClick={() => { if (!hasProvider) { onOpenSettings(); return } onPromptChange(value); onScopeChange(nextScope) }} className="flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-md border border-slate-200 bg-white px-1 text-[11px] font-medium text-slate-600 hover:border-dream-200 hover:bg-dream-50 hover:text-dream-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"><Icon className="h-3.5 w-3.5" />{label}</button>)}
      </div>
      {!hasProvider && <p className="text-xs leading-5 text-amber-700">未配置模型时可回答时间、问候和项目相关的确定性问题；一般知识、续写与润色需要外部模型。 <button type="button" onClick={onOpenSettings} className="font-semibold underline underline-offset-2">前往模型设置</button></p>}
      <div className="flex gap-2">
        <button type="button" aria-label="运行剧情体检" onClick={onHealth} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"><ScanSearch className="h-4 w-4" />剧情体检</button>
        <button type="button" aria-label="发送给 Agent" onClick={onRun} disabled={disabled || !prompt.trim()} className="inline-flex min-h-10 flex-[1.25] items-center justify-center gap-1.5 rounded-lg bg-dream-600 text-xs font-semibold text-white hover:bg-dream-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Play className="h-4 w-4" />发送给 Agent</button>
      </div>
    </div>
  )
}
