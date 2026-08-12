import { useMemo, useState } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { ListChecks, Check, AlertTriangle, ChevronDown, ChevronRight, MapPin } from 'lucide-react'
import { analyzeStoryGraph, type StoryIssue, type StoryNodeType } from '@dreamchord/story-domain'
import { getNodeData, buildSceneList, type Scene } from './sceneGraph'

/** 将相同 code 的问题分组合并，显示计数 */
function groupIssues(items: StoryIssue[]): Array<StoryIssue & { count: number; allSceneGroups: string[] }> {
  const groups = new Map<string, StoryIssue & { count: number; allSceneGroups: string[] }>()
  for (const item of items) {
    const key = item.code
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      if (item.sceneGroupId && !existing.allSceneGroups.includes(item.sceneGroupId)) {
        existing.allSceneGroups.push(item.sceneGroupId)
      }
    } else {
      groups.set(key, {
        ...item,
        count: 1,
        allSceneGroups: item.sceneGroupId ? [item.sceneGroupId] : [],
      })
    }
  }
  return Array.from(groups.values())
}

function ProjectHealthPanel({
  projectTitle, isPublished, nodes, edges, onClose, onNavigateToScene,
}: {
  projectTitle: string; isPublished: boolean; nodes: Node[]; edges: Edge[]; onClose: () => void; onNavigateToScene?: (sceneId: string) => void
}) {
  const report = useMemo(() => analyzeStoryGraph({
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
  }), [nodes, edges])

  const scenes = useMemo(() => buildSceneList(nodes, edges), [nodes, edges])
  const sceneMap = useMemo(() => {
    const m = new Map<string, Scene>()
    for (const s of scenes) m.set(s.id, s)
    return m
  }, [scenes])

  /** 通过 nodeId 查找所属场景 */
  const findSceneByNodeId = useMemo(() => {
    const nodeToScene = new Map<string, Scene>()
    for (const scene of scenes) {
      for (const nid of scene.nodeIds) nodeToScene.set(nid, scene)
    }
    return (nodeId: string) => nodeToScene.get(nodeId)
  }, [scenes])

  const items: StoryIssue[] = useMemo(() => isPublished
    ? report.issues
    : [...report.issues, {
        code: 'project-unpublished',
        level: 'info',
        title: '项目尚未发布',
        detail: '完成测试后再发布到作品广场。',
        nodeIds: [],
      }], [report.issues, isPublished])

  const grouped = useMemo(() => groupIssues(items), [items])
  const serious = useMemo(() => items.filter((item) => item.level === 'danger').length, [items])
  const warnings = useMemo(() => items.filter((item) => item.level === 'warning').length, [items])
  const infos = useMemo(() => items.filter((item) => item.level === 'info').length, [items])

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
              当前 {nodes.length} 个节点，{edges.length} 条连线，{serious} 个必须处理项，{warnings} 个建议优化项{infos > 0 ? `，${infos} 条提示` : ''}。
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
            {grouped.length === 0 && (
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
            {grouped.map((item) => (
              <IssueCard
                key={item.code}
                item={item}
                sceneMap={sceneMap}
                findSceneByNodeId={findSceneByNodeId}
                onNavigateToScene={onNavigateToScene}
                onClose={onClose}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

/** 单个问题卡片 — 支持展开查看涉及的场景，点击跳转 */
function IssueCard({
  item, sceneMap, findSceneByNodeId, onNavigateToScene, onClose,
}: {
  item: StoryIssue & { count: number; allSceneGroups: string[] }
  sceneMap: Map<string, Scene>
  findSceneByNodeId: (nodeId: string) => Scene | undefined
  onNavigateToScene?: (sceneId: string) => void
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  // 收集此问题涉及的所有场景
  const relatedScenes = useMemo(() => {
    const seen = new Set<string>()
    const result: Scene[] = []
    // 通过 sceneGroupId 查找
    for (const sgid of item.allSceneGroups) {
      const scene = sceneMap.get(sgid)
      if (scene && !seen.has(scene.id)) {
        seen.add(scene.id)
        result.push(scene)
      }
    }
    // 通过 nodeId 查找
    for (const nid of item.nodeIds) {
      const scene = findSceneByNodeId(nid)
      if (scene && !seen.has(scene.id)) {
        seen.add(scene.id)
        result.push(scene)
      }
    }
    return result
  }, [item, sceneMap, findSceneByNodeId])

  const hasScenes = relatedScenes.length > 0
  const canExpand = hasScenes && item.count > 0

  return (
    <article className={`rounded-lg border p-3 ${healthToneClass(item.level)}`}>
      <div className="flex items-start gap-2">
        {item.level === 'info' ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{item.title}</h3>
            {item.count > 1 && (
              <span className="shrink-0 rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] font-bold">
                {item.count}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 opacity-85">{item.detail}</p>
          {hasScenes && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {relatedScenes.slice(0, expanded ? undefined : 3).map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => {
                    if (onNavigateToScene) {
                      onNavigateToScene(scene.id)
                      onClose()
                    }
                  }}
                  disabled={!onNavigateToScene}
                  className="inline-flex items-center gap-1 rounded-md border border-current/20 bg-white/60 px-2 py-0.5 text-[11px] font-medium transition hover:bg-white/90 disabled:cursor-default disabled:opacity-60"
                >
                  <MapPin className="h-3 w-3" />
                  <span className="font-mono">{scene.code}</span>
                  <span className="opacity-70">{scene.title}</span>
                </button>
              ))}
              {canExpand && relatedScenes.length > 3 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium opacity-70 transition hover:opacity-100"
                >
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {expanded ? '收起' : `查看全部 ${relatedScenes.length} 个`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
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
