import { useEffect, useMemo, useState } from 'react'
import { analyzeStoryGraph, type StoryGraph } from '@dreamchord/story-domain'
import { Bot, X } from 'lucide-react'
import { createAgentConversation } from '../api/client'
import { getDefaultProvider } from '../lib/aiConfig'
import AgentApprovalBar from './AgentApprovalBar'
import AgentComposer from './AgentComposer'
import AgentTimeline from './AgentTimeline'
import PatchPreview from './PatchPreview'
import type { AgentScope, AppliedPatchDto } from './agentTypes'
import { useAgentRun } from './useAgentRun'

export default function AgentPanel({ projectId, chapterId, chapterVersion, selectedNodeId, selectedSceneId, graph, taskRequest, initialConversationId = '', onConversationChange, onApplyGraph, onSelectNode, onClose, compact = false, getGraphMutationBlockedReason }: {
  projectId: string; chapterId: string | null; chapterVersion: number | null; selectedNodeId: string | null; selectedSceneId: string | null; graph: StoryGraph
  onApplyGraph: (result: AppliedPatchDto) => void; onSelectNode: (nodeId: string) => void; onClose?: () => void
  taskRequest?: { id: number; prompt: string; scope: AgentScope }
  initialConversationId?: string; onConversationChange?: (conversationId: string) => void
  compact?: boolean
  getGraphMutationBlockedReason?: () => string | undefined
}) {
  const controller = useAgentRun()
  const provider = getDefaultProvider()
  const [prompt, setPrompt] = useState('')
  const [scope, setScope] = useState<AgentScope>(chapterId ? 'chapter' : 'project')
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [targetId, setTargetId] = useState<string | null>(selectedNodeId)
  const [localReport, setLocalReport] = useState<ReturnType<typeof analyzeStoryGraph> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!taskRequest) return
    setPrompt(taskRequest.prompt)
    setScope(taskRequest.scope)
  }, [taskRequest])

  useEffect(() => { setConversationId(initialConversationId) }, [initialConversationId])
  useEffect(() => { if (!chapterId) setScope('project') }, [chapterId])

  const cardTargets = useMemo(() => graph.nodes.map((node) => ({
    id: node.id,
    label: describeCard(node.type, node.data),
  })), [graph.nodes])
  const sceneTargets = useMemo(() => {
    const scenes = new Map<string, string>()
    for (const node of graph.nodes) {
      const sceneId = typeof node.data.sceneGroupId === 'string' ? node.data.sceneGroupId : ''
      if (!sceneId || scenes.has(sceneId)) continue
      const title = typeof node.data.sceneTitle === 'string' && node.data.sceneTitle.trim() ? node.data.sceneTitle.trim() : sceneId
      scenes.set(sceneId, title)
    }
    return [...scenes].map(([id, title]) => ({ id, label: title }))
  }, [graph.nodes])
  const selectedNodeSceneId = useMemo(() => {
    const node = graph.nodes.find((item) => item.id === selectedNodeId)
    return node && typeof node.data.sceneGroupId === 'string' ? node.data.sceneGroupId : null
  }, [graph.nodes, selectedNodeId])
  const targets = useMemo(() => scope === 'card' ? cardTargets : scope === 'scene' ? sceneTargets : [], [cardTargets, sceneTargets, scope])

  useEffect(() => {
    if (scope !== 'card' && scope !== 'scene') return
    const preferred = scope === 'card' ? selectedNodeId : selectedSceneId ?? selectedNodeSceneId
    setTargetId((current) => targets.some((target) => target.id === current)
      ? current
      : targets.some((target) => target.id === preferred) ? preferred!
        : targets[0]?.id ?? null)
  }, [scope, selectedNodeId, selectedSceneId, selectedNodeSceneId, targets])

  const runAgent = async () => {
    if (!prompt.trim()) return
    if ((scope === 'card' || scope === 'scene') && !targetId) return
    let id = conversationId
    if (!id) {
      const conversation = await createAgentConversation(projectId, {
        title: prompt.trim().slice(0, 40),
        scope: chapterId ? scope : 'project',
        ...(chapterId ? { chapterId } : {}),
      })
      id = conversation.id; setConversationId(id)
    }
    onConversationChange?.(id)
    const providerConfig = provider
      ? { provider: provider.provider, model: provider.model, apiKey: provider.apiKey, baseUrl: provider.baseUrl }
      : { provider: 'local', model: 'dreamchord-local', apiKey: '' }
    await controller.start({ projectId, conversationId: id, ...(chapterId ? { chapterId } : {}), prompt: prompt.trim(), scope: chapterId ? scope : 'project', targetId: scope === 'card' || scope === 'scene' ? targetId ?? undefined : undefined, providerConfig })
    setPrompt('')
  }

  const versionBlockedReason = chapterVersion !== null && controller.run?.status === 'awaiting_approval' && controller.run.patch && controller.run.patch.baseVersion !== chapterVersion
    ? '章节已在草稿生成后发生变化，请重新生成 Agent 草稿。'
    : undefined
  const mutationBlockedReason = getGraphMutationBlockedReason?.() || versionBlockedReason

  const applyAction = async (action: () => Promise<AppliedPatchDto>) => {
    if (getGraphMutationBlockedReason?.() || versionBlockedReason) return
    setBusy(true)
    try { onApplyGraph(await action()) } finally { setBusy(false) }
  }

  const canCompose = !controller.run || ['completed', 'failed', 'cancelled'].includes(controller.run.status)
  const showApprovalBar = Boolean(controller.run && (
    controller.run.patch || ['queued', 'planning', 'gathering_context', 'drafting', 'validating', 'applying'].includes(controller.run.status)
  ))

  return (
    <aside className={`flex ${compact ? '' : 'h-full'} flex-col bg-white text-slate-900`}>
      {!compact && <header className="flex min-h-14 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white"><Bot className="h-4 w-4" /></span><div><h3 className="text-sm font-bold">创作 Agent</h3><p className="text-[11px] text-slate-500">计划 · 校验 · 可撤销</p></div></div>
        {onClose && <button title="关闭 Agent" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
      </header>}
      <div className={compact ? '' : 'flex-1 overflow-y-auto'}>
        {canCompose && <AgentComposer prompt={prompt} scope={scope} disabled={controller.isSubmitting} hasProvider={Boolean(provider)} hasChapter={Boolean(chapterId)} targetId={targetId} targets={targets} onPromptChange={setPrompt} onScopeChange={setScope} onTargetChange={(nextTargetId) => { setTargetId(nextTargetId); if (scope === 'card') onSelectNode(nextTargetId) }} onRun={() => void runAgent()} onHealth={() => setLocalReport(analyzeStoryGraph(graph))} onOpenSettings={() => window.location.assign('/settings')} />}
        {controller.error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{controller.error}</p>}
        {localReport && canCompose && <section className="p-4"><h4 className="text-sm font-semibold">规则体检 · {localReport.issues.length} 项</h4><div className="mt-2 space-y-2">{localReport.issues.slice(0, 8).map((issue) => <button key={`${issue.code}-${issue.nodeIds.join('-')}`} onClick={() => issue.nodeIds[0] && onSelectNode(issue.nodeIds[0])} className="block w-full border-l-2 border-amber-400 py-1 pl-3 text-left"><span className="block text-xs font-medium text-slate-800">{issue.title}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{issue.detail}</span></button>)}</div></section>}
        {controller.run && <AgentTimeline run={controller.run} />}
        {controller.run?.patch && <PatchPreview patch={controller.run.patch} onSelectNode={onSelectNode} />}
      </div>
      {controller.run && showApprovalBar && <AgentApprovalBar status={controller.run.status} busy={busy} mutationBlockedReason={mutationBlockedReason} onCancel={() => void controller.cancel()} onReject={() => void controller.reject()} onApply={() => void applyAction(controller.apply)} onUndo={() => void applyAction(controller.undo)} />}
    </aside>
  )
}

function describeCard(type: string, data: Record<string, unknown>): string {
  const text = typeof data.text === 'string' ? data.text.trim() : ''
  const role = typeof data.role === 'string' ? data.role.trim() : ''
  const choices = Array.isArray(data.choices) ? data.choices.filter((item): item is string => typeof item === 'string').join(' / ') : ''
  const content = choices || text || role || type
  return `${role && text ? `${role}：` : ''}${content.slice(0, 48)}${content.length > 48 ? '…' : ''}`
}
