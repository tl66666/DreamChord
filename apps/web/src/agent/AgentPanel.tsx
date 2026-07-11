import { useEffect, useState } from 'react'
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

export default function AgentPanel({ projectId, chapterId, selectedNodeId, selectedSceneId, graph, taskRequest, onApplyGraph, onSelectNode, onClose }: {
  projectId: string; chapterId: string; chapterVersion: number; selectedNodeId: string | null; selectedSceneId: string | null; graph: StoryGraph
  onApplyGraph: (result: AppliedPatchDto) => void; onSelectNode: (nodeId: string) => void; onClose?: () => void
  taskRequest?: { id: number; prompt: string; scope: AgentScope }
}) {
  const controller = useAgentRun()
  const provider = getDefaultProvider()
  const [prompt, setPrompt] = useState('')
  const [scope, setScope] = useState<AgentScope>('chapter')
  const [conversationId, setConversationId] = useState('')
  const [localReport, setLocalReport] = useState<ReturnType<typeof analyzeStoryGraph> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!taskRequest) return
    setPrompt(taskRequest.prompt)
    setScope(taskRequest.scope)
  }, [taskRequest])

  const runAgent = async () => {
    if (!provider || !prompt.trim()) return
    let id = conversationId
    if (!id) {
      const conversation = await createAgentConversation(projectId, { title: prompt.trim().slice(0, 40), scope })
      id = conversation.id; setConversationId(id)
    }
    await controller.start({ projectId, conversationId: id, chapterId, prompt: prompt.trim(), scope, targetId: scope === 'card' ? selectedNodeId ?? undefined : scope === 'scene' ? selectedSceneId ?? undefined : undefined, providerConfig: { provider: provider.provider, model: provider.model, apiKey: provider.apiKey, baseUrl: provider.baseUrl } })
  }

  const applyAction = async (action: () => Promise<AppliedPatchDto>) => {
    setBusy(true)
    try { onApplyGraph(await action()) } finally { setBusy(false) }
  }

  return (
    <aside className="flex h-full flex-col bg-white text-slate-900">
      <header className="flex min-h-14 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white"><Bot className="h-4 w-4" /></span><div><h3 className="text-sm font-bold">创作 Agent</h3><p className="text-[11px] text-slate-500">计划 · 校验 · 可撤销</p></div></div>
        {onClose && <button title="关闭 Agent" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
      </header>
      <div className="flex-1 overflow-y-auto">
        {!controller.run && <AgentComposer prompt={prompt} scope={scope} disabled={controller.isSubmitting} hasProvider={Boolean(provider)} onPromptChange={setPrompt} onScopeChange={setScope} onRun={() => void runAgent()} onHealth={() => setLocalReport(analyzeStoryGraph(graph))} />}
        {controller.error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{controller.error}</p>}
        {localReport && !controller.run && <section className="p-4"><h4 className="text-sm font-semibold">规则体检 · {localReport.issues.length} 项</h4><div className="mt-2 space-y-2">{localReport.issues.slice(0, 8).map((issue) => <button key={`${issue.code}-${issue.nodeIds.join('-')}`} onClick={() => issue.nodeIds[0] && onSelectNode(issue.nodeIds[0])} className="block w-full border-l-2 border-amber-400 py-1 pl-3 text-left"><span className="block text-xs font-medium text-slate-800">{issue.title}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{issue.detail}</span></button>)}</div></section>}
        {controller.run && <AgentTimeline run={controller.run} />}
        {controller.run?.patch && <PatchPreview patch={controller.run.patch} onSelectNode={onSelectNode} />}
        {controller.run?.errorMessage && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{controller.run.errorMessage}</p>}
      </div>
      {controller.run && <AgentApprovalBar status={controller.run.status} busy={busy} onCancel={() => void controller.cancel()} onReject={() => void controller.reject()} onApply={() => void applyAction(controller.apply)} onUndo={() => void applyAction(controller.undo)} />}
    </aside>
  )
}
