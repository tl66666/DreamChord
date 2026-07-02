import { type Node, type Edge } from '@xyflow/react'
import { ListChecks, Check, AlertTriangle } from 'lucide-react'
import { getNodeText, getNodeSceneGroupId } from './sceneGraph'

function ProjectHealthPanel({
  projectTitle, isPublished, nodes, edges, onClose,
}: {
  projectTitle: string; isPublished: boolean; nodes: Node[]; edges: Edge[]; onClose: () => void
}) {
  const report = buildHealthReport(nodes, edges, isPublished)
  const serious = report.items.filter((item) => item.level === 'danger').length
  const warnings = report.items.filter((item) => item.level === 'warning').length

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
      <section className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-xl border border-dream-100 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-dream-100 px-5 py-4">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-dream-50 px-3 py-1 text-xs font-medium text-dream-700">
              <ListChecks className="h-3.5 w-3.5" /> 项目体检
            </div>
            <h2 className="text-xl font-bold text-slate-950">{projectTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">
              当前 {nodes.length} 个节点，{edges.length} 条连线，{serious} 个必须处理项，{warnings} 个建议优化项。
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">关闭</button>
        </header>
        <div className="grid gap-4 overflow-y-auto p-5 md:grid-cols-[220px_1fr]">
          <aside className="space-y-3">
            <HealthMetric label="剧情节点" value={nodes.length} />
            <HealthMetric label="镜头卡" value={report.sceneGroupCount} tone={report.sceneGroupCount > 0 ? 'ok' : 'warning'} />
            <HealthMetric label="选项节点" value={report.choiceCount} />
            <HealthMetric label="断开出口" value={report.disconnectedChoiceExits} tone={report.disconnectedChoiceExits > 0 ? 'danger' : 'ok'} />
            <HealthMetric label="空内容" value={report.emptyContentCount} tone={report.emptyContentCount > 0 ? 'warning' : 'ok'} />
            <HealthMetric label="不可达场景" value={report.unreachableSceneCount} tone={report.unreachableSceneCount > 0 ? 'warning' : 'ok'} />
            <HealthMetric label="结尾节点" value={report.endingCount} tone={report.endingCount > 0 ? 'ok' : 'warning'} />
          </aside>
          <div className="space-y-3">
            {report.items.map((item) => (
              <article key={item.title} className={`rounded-lg border p-3 ${healthToneClass(item.level)}`}>
                <div className="flex items-start gap-2">
                  {item.level === 'ok' ? <Check className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 opacity-85">{item.detail}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function HealthMetric({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'ok' | 'warning' | 'danger' }) {
  const toneClass = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    ok: 'border-green-200 bg-green-50 text-green-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-red-200 bg-red-50 text-red-700',
  }[tone]
  return (
    <div className={`rounded-lg border px-3 py-3 ${toneClass}`}>
      <p className="text-xs opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function healthToneClass(level: 'ok' | 'warning' | 'danger') {
  if (level === 'ok') return 'border-green-100 bg-green-50 text-green-800'
  if (level === 'warning') return 'border-amber-100 bg-amber-50 text-amber-800'
  return 'border-red-100 bg-red-50 text-red-800'
}

function buildHealthReport(nodes: Node[], edges: Edge[], isPublished: boolean) {
  const items: Array<{ level: 'ok' | 'warning' | 'danger'; title: string; detail: string }> = []
  const choiceNodes = nodes.filter((node) => node.type === 'choice')
  const dialogueNodes = nodes.filter((node) => node.type === 'dialogue' || node.type === 'subtitle')
  const emptyContentNodes = dialogueNodes.filter((node) => !getNodeText(node).trim())
  const nodeIds = new Set(nodes.map((node) => node.id))
  const sceneGroups = new Set(nodes.map((node) => getNodeSceneGroupId(node)).filter(Boolean))
  const invalidEdges = edges.filter((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  edges.forEach((edge) => { incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1); outgoing.set(edge.source, (outgoing.get(edge.source) || 0) + 1) })
  const startCandidates = nodes.filter((node) => !incoming.has(node.id))
  const isolatedNodes = nodes.filter((node) => !incoming.has(node.id) && !outgoing.has(node.id) && nodes.length > 1)
  const endingNodes = nodes.filter((node) => node.type !== 'choice' && !outgoing.has(node.id))
  const reachableNodeIds = collectReachableNodeIds(nodes, edges, startCandidates[0]?.id)
  const unreachableSceneIds = new Set(
    nodes
      .filter((node) => !reachableNodeIds.has(node.id))
      .map((node) => getNodeSceneGroupId(node))
      .filter(Boolean),
  )
  let disconnectedChoiceExits = 0
  const choiceExitLabels: string[] = []
  choiceNodes.forEach((node) => {
    const choices = Array.isArray(node.data.choices) ? (node.data.choices as string[]) : []
    choices.forEach((_, index) => {
      const edge = edges.find((item) => item.source === node.id && item.sourceHandle === `choice-${index}`)
      if (!edge) disconnectedChoiceExits += 1
      else choiceExitLabels.push(`${choices[index] || `选项 ${index + 1}`} -> ${edge.label || edge.target}`)
    })
  })
  if (nodes.length === 0) items.push({ level: 'danger', title: '故事还没有节点', detail: '先添加旁白、对话或背景节点，播放器才有内容可读。' })
  else items.push({ level: 'ok', title: '故事节点已建立', detail: `当前已有 ${nodes.length} 个节点，可以继续扩写主线或分支。` })
  if (sceneGroups.size > 0) items.push({ level: 'ok', title: '镜头卡结构可用', detail: `检测到 ${sceneGroups.size} 个镜头卡。建议继续按"章节 → 场景 → 镜头卡"的方式维护长篇剧情。` })
  else if (nodes.length > 0) items.push({ level: 'warning', title: '建议使用镜头卡整理剧情', detail: '当前节点还没有场景分组。长篇故事建议用场景编辑器创建镜头卡，避免节点列表过长后难以维护。' })
  if (invalidEdges.length > 0) items.push({ level: 'danger', title: '存在失效连线', detail: `${invalidEdges.length} 条连线指向已经不存在的节点。建议删除这些连线，或重新连接到正确场景。` })
  if (startCandidates.length === 1) items.push({ level: 'ok', title: '起点清晰', detail: '当前节点图只有一个入口，播放器会从这里开始阅读。' })
  else if (nodes.length > 0) items.push({ level: 'warning', title: '起点不够明确', detail: `检测到 ${startCandidates.length} 个没有前置连线的节点。建议只保留一个故事起点。` })
  if (disconnectedChoiceExits > 0) items.push({ level: 'danger', title: '存在断开的选项出口', detail: `有 ${disconnectedChoiceExits} 个选项还没有连接后续剧情。` })
  else if (choiceNodes.length > 0) items.push({ level: 'ok', title: '选项出口已连接', detail: choiceExitLabels.length > 0 ? `每个选项都有对应后续：${choiceExitLabels.slice(0, 4).join('；')}` : '每个选项都有对应后续。' })
  if (emptyContentNodes.length > 0) items.push({ level: 'warning', title: '存在空文本节点', detail: `${emptyContentNodes.length} 个对话/旁白节点没有内容，建议补上台词或删除。` })
  else if (dialogueNodes.length > 0) items.push({ level: 'ok', title: '文本节点完整', detail: '对话和旁白节点都有可播放文本。' })
  if (!nodes.some((node) => node.type === 'background')) items.push({ level: 'warning', title: '建议添加背景节点', detail: '没有显式背景切换时，播放器会使用默认背景。' })
  if (!nodes.some((node) => node.type === 'character')) items.push({ level: 'warning', title: '建议添加角色登场节点', detail: '没有角色节点时，播放器只会显示背景和文本。' })
  if (isolatedNodes.length > 0) items.push({ level: 'warning', title: '存在孤立节点', detail: `${isolatedNodes.length} 个节点没有接入任何剧情线。` })
  if (unreachableSceneIds.size > 0) {
    items.push({
      level: 'warning',
      title: '存在不可达场景',
      detail: `${unreachableSceneIds.size} 个场景从当前起点无法抵达。请在场景前接入主线、选项出口或跳转节点。`,
    })
  } else if (nodes.length > 0) {
    items.push({ level: 'ok', title: '场景可达性正常', detail: '从当前故事起点可以走到所有已接入的场景。' })
  }
  if (endingNodes.length === 0 && nodes.length > 0) items.push({ level: 'warning', title: '没有明确结尾', detail: '当前所有非选项节点都有后续，可能存在循环。' })
  else if (endingNodes.length > 0) items.push({ level: 'ok', title: '存在可到达结尾', detail: `检测到 ${endingNodes.length} 个可能的结尾节点。` })
  if (!isPublished) items.push({ level: 'warning', title: '项目尚未发布', detail: '测试完成后再点击发布。' })
  return { items, choiceCount: choiceNodes.length, sceneGroupCount: sceneGroups.size, disconnectedChoiceExits, emptyContentCount: emptyContentNodes.length, endingCount: endingNodes.length, unreachableSceneCount: unreachableSceneIds.size }
}

function collectReachableNodeIds(nodes: Node[], edges: Edge[], startId?: string) {
  const reachable = new Set<string>()
  if (!startId) return reachable
  const nodeIds = new Set(nodes.map((node) => node.id))
  const queue = [startId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (reachable.has(current) || !nodeIds.has(current)) continue
    reachable.add(current)
    edges
      .filter((edge) => edge.source === current)
      .forEach((edge) => {
        if (!reachable.has(edge.target)) queue.push(edge.target)
      })
  }
  return reachable
}

export { ProjectHealthPanel }
