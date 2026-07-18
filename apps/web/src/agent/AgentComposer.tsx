import { BookOpen, GitBranch, Image as ImageIcon, MessageSquareText, Play, ScanSearch, Settings2, Users, WandSparkles } from 'lucide-react'
import type { AgentScope } from './agentTypes'

const scopes: Array<{ value: AgentScope; label: string }> = [
  { value: 'card', label: '当前镜头' }, { value: 'scene', label: '当前场景' },
  { value: 'chapter', label: '当前章节' }, { value: 'project', label: '全项目' },
]
const shortcuts = [
  { label: '润色当前', icon: WandSparkles, prompt: '润色当前镜头，保持角色语言习惯和原意。', scope: 'card' as const },
  { label: '续写场景', icon: MessageSquareText, prompt: '承接当前场景续写一组有推进作用的镜头。', scope: 'scene' as const },
  { label: '补充分支', icon: GitBranch, prompt: '检查当前章节的选择节点，并补充一个有实质差异的合理分支。', scope: 'chapter' as const },
  { label: '生成试玩场景', icon: Play, prompt: '根据当前对话中最近一份续写草稿，创建可编辑的工作台场景；只复用与草稿匹配的已有素材，并先生成可审批补丁。', scope: 'chapter' as const, localCapable: true },
]
const starters = [
  { label: '了解项目', icon: BookOpen, prompt: '概括整个项目，并告诉我现在最值得先完善什么。', scope: 'project' as const },
  { label: '检查剧情', icon: ScanSearch, prompt: '检查当前故事的剧情结构、断路和薄弱环节，并按优先级说明。', scope: 'project' as const },
  { label: '梳理角色', icon: Users, prompt: '梳理项目角色的目标、关系和可能缺失的设定。', scope: 'project' as const },
  { label: '素材建议', icon: ImageIcon, prompt: '盘点全局素材，并建议还需要准备哪些背景、CG 或角色立绘。', scope: 'project' as const },
]

export default function AgentComposer({ prompt, scope, disabled, hasProvider, hasChapter = true, hasSelectedScene = false, targetId, targets, activeProvider, modelOptions = [], compact = false, materialMode = 'reuse', healthOpen = false, onPromptChange, onScopeChange, onTargetChange, onModelChange, onMaterialModeChange, onRun, onQuickRun, onConvertText, onHealth, onOpenSettings }: {
  prompt: string; scope: AgentScope; disabled: boolean; hasProvider: boolean; hasChapter?: boolean
  hasSelectedScene?: boolean; targetId?: string | null; targets?: Array<{ id: string; label: string }>
  activeProvider?: { name: string; model: string } | null; modelOptions?: string[]; compact?: boolean; materialMode?: 'reuse' | 'prompts'
  healthOpen?: boolean
  onPromptChange: (value: string) => void; onScopeChange: (scope: AgentScope) => void; onTargetChange?: (targetId: string) => void; onModelChange?: (model: string) => void; onMaterialModeChange?: (mode: 'reuse' | 'prompts') => void; onRun: () => void; onQuickRun?: (request: { prompt: string; scope: AgentScope }) => void; onConvertText?: () => void; onHealth: () => void; onOpenSettings: () => void
}) {
  const needsTarget = (scope === 'card' || scope === 'scene') && Boolean(targets?.length)
  const submit = () => {
    if (disabled || !prompt.trim() || (needsTarget && !targetId)) return
    onRun()
  }
  const playableSceneShortcut = shortcuts.find((item) => item.localCapable)!

  return (
    <div className={`${compact ? 'space-y-2 p-3' : 'space-y-3 p-4'} border-b border-slate-200`}>
      {compact ? <div className="grid grid-cols-2 gap-1.5">
        <label className="block">
        <span className="sr-only">常用任务</span>
        <select aria-label="常用任务" value="" onChange={(event) => {
          const starter = starters.find((item) => item.label === event.target.value)
          if (starter) { onPromptChange(starter.prompt); onScopeChange(starter.scope) }
        }} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-dream-500">
          <option value="">选择常用任务</option>
          {starters.map((starter) => <option key={starter.label} value={starter.label}>{starter.label}</option>)}
        </select>
        </label>
        <div aria-label="当前模型" className="flex h-9 min-w-0 items-center gap-1.5 border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600">
          {activeProvider ? <select aria-label="切换当前模型" value={activeProvider.model} onChange={(event) => onModelChange?.(event.target.value)} className="min-w-0 flex-1 bg-transparent font-medium text-slate-800 outline-none">
            {modelOptions.map((model) => <option key={model} value={model}>{activeProvider.name} · {model}</option>)}
          </select> : <span className="min-w-0 flex-1 truncate font-medium text-slate-700">本地创作模式</span>}
          <button type="button" aria-label="模型设置" title="模型设置" onClick={onOpenSettings} className="grid h-7 w-7 shrink-0 place-items-center text-slate-500 hover:bg-white hover:text-slate-950"><Settings2 className="h-3.5 w-3.5" /></button>
        </div>
      </div> : <div>
        <p className="mb-1.5 text-[11px] font-semibold text-slate-500">直接问 Agent</p>
        <div className="grid grid-cols-2 gap-1.5">
          {starters.map(({ label, icon: Icon, prompt: value, scope: nextScope }) => <button key={label} type="button" aria-label={label} onClick={() => { onPromptChange(value); onScopeChange(nextScope) }} className="flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left text-[11px] font-medium text-slate-700 hover:border-cyan-200 hover:bg-cyan-50"><Icon className="h-3.5 w-3.5 shrink-0 text-cyan-700" />{label}</button>)}
        </div>
      </div>}
      <div className={`grid ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'} gap-1 rounded-lg bg-slate-100 p-1`} aria-label="Agent 作用域">
        {scopes.map((item) => {
          const unavailable = !hasChapter && item.value !== 'project'
          return <button key={item.value} type="button" disabled={unavailable} title={unavailable ? '绑定章节后可用' : undefined} onClick={() => onScopeChange(item.value)} className={`min-h-9 rounded-md px-2 text-xs font-medium transition ${scope === item.value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'} disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:text-slate-300`}>{item.label}</button>
        })}
      </div>
      {hasChapter && scope !== 'project' && <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">素材策略</span>
        <select aria-label="素材策略" value={materialMode} onChange={(event) => onMaterialModeChange?.(event.target.value as 'reuse' | 'prompts')} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-dream-500">
          <option value="reuse">自动复用素材库并搭建场景</option>
          <option value="prompts">仅生成背景、立绘、CG 提示词</option>
        </select>
      </label>}
      {needsTarget && <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">修改目标</span>
        <select aria-label="修改目标" value={targetId ?? ''} onChange={(event) => onTargetChange?.(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-dream-500 focus:ring-2 focus:ring-dream-500/15">
          <option value="">选择要处理的内容</option>
          {targets?.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
        </select>
        <p className="mt-1.5 text-[11px] leading-4 text-slate-500">会先生成可审阅草案，不会直接改写故事。</p>
      </label>}
      {!compact && <div aria-label="当前模型" className="flex min-h-9 items-center gap-2 border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600">
        <span className="shrink-0 font-medium text-slate-500">模型</span>
        {activeProvider ? <select aria-label="切换当前模型" value={activeProvider.model} onChange={(event) => onModelChange?.(event.target.value)} className="min-w-0 flex-1 bg-transparent font-medium text-slate-800 outline-none">
          {modelOptions.map((model) => <option key={model} value={model}>{activeProvider.name} · {model}</option>)}
        </select> : <span className="min-w-0 flex-1 font-medium text-slate-700">本地创作模式</span>}
        <button type="button" aria-label="模型设置" title="模型设置" onClick={onOpenSettings} className="grid h-7 w-7 shrink-0 place-items-center text-slate-500 hover:bg-white hover:text-slate-950"><Settings2 className="h-3.5 w-3.5" /></button>
      </div>}
      <label className="block">
        <span className="sr-only">创作任务</span>
        <textarea aria-label="创作任务" value={prompt} onChange={(event) => onPromptChange(event.target.value)} onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
          event.preventDefault()
          submit()
        }} rows={compact ? 2 : 5} placeholder="直接聊天，或描述你想检查、续写、修改的内容…" className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-dream-500 focus:ring-2 focus:ring-dream-500/15" />
      </label>
      {hasChapter && onConvertText && <button type="button" aria-label="将正文转为场景" disabled={disabled || !prompt.trim()} onClick={onConvertText} className="flex min-h-9 w-full items-center justify-center gap-1.5 border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"><WandSparkles className="h-3.5 w-3.5" />将正文转为场景</button>}
      {!compact && <div className="grid grid-cols-2 gap-1.5">
        {shortcuts.map(({ label, icon: Icon, prompt: value, scope: nextScope, localCapable = false }) => <button key={label} type="button" title={!hasChapter ? '绑定章节后可用' : label} disabled={!hasChapter} onClick={() => { if (!hasProvider && !localCapable) { onOpenSettings(); return } onPromptChange(value); onScopeChange(nextScope) }} className="flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-md border border-slate-200 bg-white px-1 text-[11px] font-medium text-slate-600 hover:border-dream-200 hover:bg-dream-50 hover:text-dream-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"><Icon className="h-3.5 w-3.5" />{label}</button>)}
      </div>}
      {!hasProvider && !compact && <p className="text-xs leading-5 text-amber-700">未配置模型时仍可读取项目、章节、角色、素材、对话和记忆，解释创作方法；对已选台词用“改成：新内容”可生成可审批的精确替换草案。开放式续写再配置外部模型。 <button type="button" onClick={onOpenSettings} className="font-semibold underline underline-offset-2">前往模型设置</button></p>}
      {compact && <div className="grid grid-cols-[minmax(0,1fr)_40px_minmax(104px,0.9fr)] gap-1.5">
        <button type="button" aria-label={hasSelectedScene ? '续写已选场景' : playableSceneShortcut.label} title={!hasChapter ? '绑定章节后可用' : hasSelectedScene ? '续写已选场景' : playableSceneShortcut.label} disabled={!hasChapter} onClick={() => { const request = { prompt: hasSelectedScene ? '承接已选场景继续续写，保持已有角色、地点和未解决线索。请生成可审阅的镜头卡和连线。' : playableSceneShortcut.prompt, scope: hasSelectedScene ? 'scene' as const : playableSceneShortcut.scope }; if (onQuickRun) onQuickRun(request); else { onPromptChange(request.prompt); onScopeChange(request.scope) } }} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-dream-200 bg-dream-50 px-2 text-xs font-semibold text-dream-700 hover:bg-dream-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"><Play className="h-4 w-4" />{hasSelectedScene ? '续写已选场景' : playableSceneShortcut.label}</button>
        <button type="button" aria-label={healthOpen ? '收起剧情体检' : '运行剧情体检'} title={healthOpen ? '收起剧情体检' : '运行剧情体检'} onClick={onHealth} className={`inline-flex min-h-10 items-center justify-center rounded-lg border text-slate-700 hover:bg-slate-50 ${healthOpen ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}><ScanSearch className="h-4 w-4" /></button>
        <button type="button" aria-label="发送给 Agent" onClick={submit} disabled={disabled || !prompt.trim() || (needsTarget && !targetId)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-dream-600 px-2 text-xs font-semibold text-white hover:bg-dream-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Play className="h-4 w-4" />发送</button>
      </div>}
      {!compact && <div className="flex gap-2">
        <button type="button" aria-label={healthOpen ? '收起剧情体检' : '运行剧情体检'} onClick={onHealth} className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold text-slate-700 hover:bg-slate-50 ${healthOpen ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}><ScanSearch className="h-4 w-4" />{healthOpen ? '收起体检' : '剧情体检'}</button>
        <button type="button" aria-label="发送给 Agent" onClick={submit} disabled={disabled || !prompt.trim() || (needsTarget && !targetId)} className="inline-flex min-h-10 flex-[1.25] items-center justify-center gap-1.5 rounded-lg bg-dream-600 text-xs font-semibold text-white hover:bg-dream-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Play className="h-4 w-4" />发送给 Agent</button>
      </div>}
    </div>
  )
}
