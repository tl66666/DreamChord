import type { StoryGraph, StoryNode } from '@dreamchord/story-domain'
import { prisma } from '../lib/prisma.js'
import { storyBibleContentSchema, type StoryBibleContent } from '../routes/storyBible.js'

export type AgentScope = 'card' | 'scene' | 'chapter' | 'project'

export interface AgentContextSource {
  id: string
  kind: 'project' | 'story-bible' | 'character' | 'chapter-outline' | 'scene' | 'search-result' | 'health-report'
  title: string
  content: string
  nodeIds: string[]
}

export interface AgentProjectSnapshot {
  projectId: string
  title: string
  description: string
  bible: StoryBibleContent | null
  characters: Array<{ id: string; name: string; description: string }>
  chapters: Array<{ id: string; title: string; version: number; graph: StoryGraph }>
}

export interface AgentContextRequest {
  scope: AgentScope
  chapterId?: string
  targetId?: string
}

function textOf(node: StoryNode): string {
  const text = typeof node.data.text === 'string' ? node.data.text : ''
  const role = typeof node.data.role === 'string' ? node.data.role : ''
  if (node.type === 'choice' && Array.isArray(node.data.choices)) return `选项：${node.data.choices.join(' / ')}`
  return role ? `${role}：${text}` : text || `${node.type} 节点`
}

function referencedCharacterIds(nodes: StoryNode[], snapshot: AgentProjectSnapshot): Set<string> {
  const references = new Set<string>()
  for (const node of nodes) {
    const candidates = [node.data.role, node.data.characterId].filter((value): value is string => typeof value === 'string')
    for (const character of snapshot.characters) {
      if (candidates.includes(character.id) || candidates.includes(character.name)) references.add(character.id)
    }
  }
  return references
}

function source(id: string, kind: AgentContextSource['kind'], title: string, content: string, nodeIds: string[] = []): AgentContextSource {
  return { id, kind, title, content: content.slice(0, 20_000), nodeIds }
}

function bibleSummary(bible: StoryBibleContent): string {
  return [
    `世界观：${bible.worldSummary}`,
    `主题：${bible.themes.join('、')}`,
    `文风：${bible.styleGuide}`,
    `时空规则：${bible.timelineRules}`,
    `禁止事项：${bible.forbiddenElements.join('；')}`,
  ].join('\n')
}

export function buildInitialContext(snapshot: AgentProjectSnapshot, request: AgentContextRequest): AgentContextSource[] {
  const sources: AgentContextSource[] = [source('project:brief', 'project', snapshot.title, `${snapshot.title}\n${snapshot.description}`)]
  if (snapshot.bible) sources.push(source('story-bible:summary', 'story-bible', '故事圣经', bibleSummary(snapshot.bible)))

  if (request.scope === 'project') {
    const outline = snapshot.chapters.map((chapter) => `${chapter.title}：${chapter.graph.nodes.length} 个节点，版本 ${chapter.version}`).join('\n')
    sources.push(source('project:outline', 'chapter-outline', '全项目章节大纲', outline))
    return sources
  }

  const chapter = snapshot.chapters.find((item) => item.id === request.chapterId)
  if (!chapter) return sources
  if (request.scope === 'chapter') {
    const groups = new Map<string, number>()
    chapter.graph.nodes.forEach((node) => {
      const group = typeof node.data.sceneGroupId === 'string' ? node.data.sceneGroupId : '未分组'
      groups.set(group, (groups.get(group) ?? 0) + 1)
    })
    sources.push(source(`chapter:${chapter.id}:outline`, 'chapter-outline', chapter.title, [...groups].map(([group, count]) => `${group}：${count} 个节点`).join('\n')))
    return sources
  }

  let selectedNodes: StoryNode[] = []
  if (request.scope === 'card') {
    const index = chapter.graph.nodes.findIndex((node) => node.id === request.targetId)
    if (index >= 0) selectedNodes = chapter.graph.nodes.slice(Math.max(0, index - 4), index + 5)
  } else {
    selectedNodes = chapter.graph.nodes.filter((node) => node.data.sceneGroupId === request.targetId)
  }

  if (selectedNodes.length > 0) {
    sources.push(source(
      `scene:${request.targetId || chapter.id}`,
      'scene',
      request.scope === 'card' ? '当前镜头上下文' : '当前场景',
      selectedNodes.map((node) => `${node.id} | ${textOf(node)}`).join('\n'),
      selectedNodes.map((node) => node.id),
    ))
  }

  for (const characterId of referencedCharacterIds(selectedNodes, snapshot)) {
    const character = snapshot.characters.find((item) => item.id === characterId)
    const note = snapshot.bible?.characterNotes[characterId]
    if (!character) continue
    const content = [character.description, note && `目标：${note.goal}\n秘密：${note.secret}\n语言：${note.voice}\n关系：${note.relations}`].filter(Boolean).join('\n')
    sources.push(source(`character:${characterId}`, 'character', character.name, content))
  }
  return sources
}

function parseData(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
  } catch { return {} }
}

export async function loadAgentProjectSnapshot(projectId: string): Promise<AgentProjectSnapshot | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { storyBible: true, characters: true, chapters: { orderBy: { order: 'asc' }, include: { nodes: true, edges: true } } },
  })
  if (!project) return null
  const parsedBible = project.storyBible ? storyBibleContentSchema.safeParse(JSON.parse(project.storyBible.content)) : null
  return {
    projectId: project.id,
    title: project.title,
    description: project.description ?? '',
    bible: parsedBible?.success ? parsedBible.data : null,
    characters: project.characters.map((character) => ({ id: character.id, name: character.name, description: character.description ?? '' })),
    chapters: project.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      version: chapter.version,
      graph: {
        nodes: chapter.nodes.map((node) => ({ id: node.nodeId, type: node.type as StoryNode['type'], position: { x: node.positionX, y: node.positionY }, data: parseData(node.data) })),
        edges: chapter.edges.map((edge) => ({ id: edge.edgeId, source: edge.source, target: edge.target, label: edge.label ?? undefined, sourceHandle: edge.sourceHandle ?? undefined, animated: edge.animated })),
      },
    })),
  }
}
