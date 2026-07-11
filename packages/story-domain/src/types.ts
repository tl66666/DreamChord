export const STORY_NODE_TYPES = [
  'dialogue',
  'choice',
  'background',
  'character',
  'transition',
  'subtitle',
  'delay',
  'condition',
  'setVariable',
  'jump',
] as const

export type StoryNodeType = (typeof STORY_NODE_TYPES)[number]

export interface StoryNode {
  id: string
  type: StoryNodeType
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface StoryEdge {
  id: string
  source: string
  target: string
  label?: string
  sourceHandle?: string
  animated: boolean
}

export interface StoryGraph {
  nodes: StoryNode[]
  edges: StoryEdge[]
}

export type IssueLevel = 'info' | 'warning' | 'danger'

export interface StoryIssue {
  code: string
  level: IssueLevel
  title: string
  detail: string
  nodeIds: string[]
  sceneGroupId?: string
  fixKind?: 'connect-choice' | 'remove-edge' | 'fill-text' | 'review-branch'
}
