import { type Node, type Edge } from '@xyflow/react'
import { ListChecks, Check, AlertTriangle } from 'lucide-react'
import { analyzeStoryGraph, type StoryIssue, type StoryNodeType } from '@dreamchord/story-domain'
import { getNodeData } from './sceneGraph'

function ProjectHealthPanel({
  projectTitle, isPublished, nodes, edges, onClose,
}: {
  projectTitle: string; isPublished: boolean; nodes: Node[]; edges: Edge[]; onClose: () => void
}) {
  const report = analyzeStoryGraph({
    nodes: nodes.map((node) => ({
      id: node.id,
      type: (node.type || 'dialogue') as StoryNodeType,
      position: node.position,
      data: getNodeData(node),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === 'string' ? edge.label : undefined,
      sourceHandle: edge.sourceHandle || undefined,
      animated: edge.animated ?? true,
    })),
  })
  const items: StoryIssue[] = isPublished
    ? report.issues
    : [...report.issues, {
        code: 'project-unpublished',
        level: 'info',
        title: '项目尚未发布',
        detail: '完成测试后再发布到作品广场。',
        nodeIds: [],
      }]
  const serious = items.filter((item) => item.level === 'danger').length
  const warnings = items.filter((item) => item.level === 'warning').length

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
            <HealthMetric label="镜头卡" value={report.metrics.sceneGroupCount} tone={report.metrics.sceneGroupCount > 0 ? 'ok' : 'warning'} />
            <HealthMetric label="选项节点" value={report.metrics.choiceCount} />
            <HealthMetric label="严重问题" value={serious} tone={serious > 0 ? 'danger' : 'ok'} />
            <HealthMetric label="建议优化" value={warnings} tone={warnings > 0 ? 'warning' : 'ok'} />
            <HealthMetric label="不可达节点" value={report.metrics.unreachableCount} tone={report.metrics.unreachableCount > 0 ? 'warning' : 'ok'} />
            <HealthMetric label="结尾节点" value={report.metrics.endingCount} tone={report.metrics.endingCount > 0 ? 'ok' : 'warning'} />
          </aside>
          <div className="space-y-3">
            {items.length === 0 && (
              <article className="rounded-lg border border-green-100 bg-green-50 p-3 text-green-800">
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4" />
                  <div>
                    <h3 className="text-sm font-semibold">剧情结构健康</h3>
                    <p className="mt-1 text-xs leading-5 opacity-85">当前没有检测到结构问题，可以继续创作或预览。</p>
                  </div>
                </div>
              </article>
            )}
            {items.map((item) => (
              <article key={`${item.code}-${item.nodeIds.join('-')}`} className={`rounded-lg border p-3 ${healthToneClass(item.level)}`}>
                <div className="flex items-start gap-2">
                  {item.level === 'info' ? <Check className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
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

function healthToneClass(level: StoryIssue['level']) {
  if (level === 'info') return 'border-sky-100 bg-sky-50 text-sky-800'
  if (level === 'warning') return 'border-amber-100 bg-amber-50 text-amber-800'
  return 'border-red-100 bg-red-50 text-red-800'
}

export { ProjectHealthPanel }
