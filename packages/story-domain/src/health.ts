import type { StoryGraph, StoryIssue, StoryNode } from './types.js'

export interface StoryHealthReport {
  issues: StoryIssue[]
  metrics: {
    nodeCount: number
    edgeCount: number
    choiceCount: number
    sceneGroupCount: number
    endingCount: number
    unreachableCount: number
  }
}

function stringField(node: StoryNode, key: string): string {
  const value = node.data[key]
  return typeof value === 'string' ? value : ''
}

function choicesOf(node: StoryNode): string[] {
  const value = node.data.choices
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function collectReachable(graph: StoryGraph, startId?: string): Set<string> {
  const reachable = new Set<string>()
  if (!startId) return reachable
  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  const queue = [startId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || reachable.has(current) || !nodeIds.has(current)) continue
    reachable.add(current)
    for (const edge of graph.edges) {
      if (edge.source === current && nodeIds.has(edge.target) && !reachable.has(edge.target)) {
        queue.push(edge.target)
      }
    }
  }
  return reachable
}

export function analyzeStoryGraph(graph: StoryGraph): StoryHealthReport {
  const issues: StoryIssue[] = []
  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  const validEdges = graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
  const invalidEdges = graph.edges.filter((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()

  for (const edge of validEdges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1)
  }

  for (const edge of invalidEdges) {
    issues.push({
      code: 'invalid-edge',
      level: 'danger',
      title: '存在失效连线',
      detail: `连线 ${edge.id} 指向不存在的节点。`,
      nodeIds: [edge.source, edge.target].filter((id) => nodeIds.has(id)),
      fixKind: 'remove-edge',
    })
  }

  const startCandidates = graph.nodes.filter((node) => !incoming.has(node.id))
  if (graph.nodes.length > 0 && startCandidates.length !== 1) {
    issues.push({
      code: 'multiple-starts',
      level: 'warning',
      title: '故事入口不唯一',
      detail: `检测到 ${startCandidates.length} 个没有前置连线的节点。`,
      nodeIds: startCandidates.map((node) => node.id),
    })
  }

  for (const node of graph.nodes) {
    if ((node.type === 'dialogue' || node.type === 'subtitle') && !stringField(node, 'text').trim()) {
      issues.push({
        code: 'empty-text',
        level: 'warning',
        title: '存在空文本节点',
        detail: '对话或旁白没有可播放文本。',
        nodeIds: [node.id],
        sceneGroupId: stringField(node, 'sceneGroupId') || undefined,
        fixKind: 'fill-text',
      })
    }

    if (!incoming.has(node.id) && !outgoing.has(node.id) && graph.nodes.length > 1) {
      issues.push({
        code: 'isolated-node',
        level: 'warning',
        title: '存在孤立节点',
        detail: '该节点没有接入任何剧情线。',
        nodeIds: [node.id],
        sceneGroupId: stringField(node, 'sceneGroupId') || undefined,
      })
    }

    if (node.type === 'choice') {
      const choices = choicesOf(node)
      const choiceTargets: string[] = []
      choices.forEach((choice, index) => {
        const edge = validEdges.find((candidate) => candidate.source === node.id && candidate.sourceHandle === `choice-${index}`)
        if (!edge) {
          issues.push({
            code: 'choice-exit-missing',
            level: 'danger',
            title: '选项没有后续剧情',
            detail: `“${choice || `选项 ${index + 1}`}”尚未连接目标。`,
            nodeIds: [node.id],
            sceneGroupId: stringField(node, 'sceneGroupId') || undefined,
            fixKind: 'connect-choice',
          })
        } else {
          choiceTargets.push(edge.target)
        }
      })

      if (choiceTargets.length > 1 && new Set(choiceTargets).size === 1) {
        issues.push({
          code: 'shallow-branch',
          level: 'warning',
          title: '分支没有实质差异',
          detail: '多个选项立即进入同一个节点，建议为各分支补充独立内容。',
          nodeIds: [node.id, choiceTargets[0]],
          sceneGroupId: stringField(node, 'sceneGroupId') || undefined,
          fixKind: 'review-branch',
        })
      }
    }
  }

  const reachable = collectReachable({ nodes: graph.nodes, edges: validEdges }, startCandidates[0]?.id)
  const unreachable = graph.nodes.filter((node) => !reachable.has(node.id))
  for (const node of unreachable) {
    issues.push({
      code: 'node-unreachable',
      level: 'warning',
      title: '节点不可达',
      detail: '从当前故事入口无法到达该节点。',
      nodeIds: [node.id],
      sceneGroupId: stringField(node, 'sceneGroupId') || undefined,
    })
  }

  if (graph.nodes.length > 0 && !graph.nodes.some((node) => node.type === 'background')) {
    issues.push({ code: 'missing-background', level: 'info', title: '没有背景节点', detail: '播放器将使用默认背景。', nodeIds: [] })
  }
  if (graph.nodes.length > 0 && !graph.nodes.some((node) => node.type === 'character')) {
    issues.push({ code: 'missing-character', level: 'info', title: '没有角色节点', detail: '当前故事只会显示背景与文本。', nodeIds: [] })
  }

  const endings = graph.nodes.filter((node) => node.type !== 'choice' && !outgoing.has(node.id))
  if (graph.nodes.length > 0 && endings.length === 0) {
    issues.push({ code: 'no-ending', level: 'warning', title: '没有明确结尾', detail: '所有非选项节点都有后续，故事可能形成循环。', nodeIds: [] })
  }

  const sceneGroups = new Set(graph.nodes.map((node) => stringField(node, 'sceneGroupId')).filter(Boolean))
  return {
    issues,
    metrics: {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      choiceCount: graph.nodes.filter((node) => node.type === 'choice').length,
      sceneGroupCount: sceneGroups.size,
      endingCount: endings.length,
      unreachableCount: unreachable.length,
    },
  }
}
