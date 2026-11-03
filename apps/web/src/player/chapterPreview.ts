import type { ProjectDetail } from '../api/client'
import type { RuntimeStory } from '../engine/types'
import { safeJsonParse } from '../lib/safeJsonParse'

/** Only a chapter actually loaded in this public/authorized project can be selected. */
export function chapterStartId(story: RuntimeStory, chapters: ProjectDetail['chapters'], search: string) {
  const value = new URLSearchParams(search).get('chapter')
  if (value === null || !/^\d+$/.test(value)) return null
  const chapter = [...chapters].sort((a, b) => a.order - b.order)[Number(value)]
  return chapter ? story.scenes.find(scene => scene.id.startsWith(`${chapter.id}:`))?.id ?? null : null
}

export function mergeChaptersForPreview(project: ProjectDetail) {
  const nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }> = []
  const edges: Array<{
    id: string
    source: string
    target: string
    label?: string
    sourceHandle?: string
    animated?: boolean
  }> = []

  const sortedChapters = [...project.chapters].sort((a, b) => a.order - b.order)
  let previousTerminalIds: string[] = []

  sortedChapters.forEach((chapter) => {
    const prefix = `${chapter.id}:`
    const chapterNodes = chapter.nodes.map((node) => ({
      id: `${prefix}${node.nodeId}`,
      type: node.type,
      position: { x: node.positionX, y: node.positionY },
      data: safeJsonParse<Record<string, unknown>>(node.data, {}),
    }))
    const chapterEdges = chapter.edges.map((edge) => ({
      id: `${prefix}${edge.edgeId}`,
      source: `${prefix}${edge.source}`,
      target: `${prefix}${edge.target}`,
      label: edge.label || undefined,
      sourceHandle: edge.sourceHandle || undefined,
      animated: edge.animated,
    }))
    const chapterStart = findPreviewStart(chapterNodes, chapterEdges)
    if (chapterStart) {
      previousTerminalIds.forEach((terminalId) => {
        edges.push({
          id: `chapter-link-${terminalId}-${chapterStart.id}`,
          source: terminalId,
          target: chapterStart.id,
          animated: true,
        })
      })
    }

    nodes.push(...chapterNodes)
    edges.push(...chapterEdges)
    previousTerminalIds = findPreviewTerminals(chapterNodes, chapterEdges)
  })

  return { nodes, edges }
}

function findPreviewStart(nodes: Array<{ id: string }>, edges: Array<{ target: string }>) {
  const targets = new Set(edges.map((edge) => edge.target))
  return nodes.find((node) => !targets.has(node.id)) || nodes[0]
}

function findPreviewTerminals(nodes: Array<{ id: string }>, edges: Array<{ source: string }>) {
  const sources = new Set(edges.map((edge) => edge.source))
  const terminals = nodes.filter((node) => !sources.has(node.id)).map((node) => node.id)
  return terminals.length > 0 ? terminals : nodes.slice(-1).map((node) => node.id)
}
