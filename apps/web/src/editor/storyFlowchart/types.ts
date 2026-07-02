import type { Scene } from '../sceneGraph'

export interface CardPosition {
  x: number
  y: number
  isBranch: boolean
  laneIndex: number
  rank: number
  isManual?: boolean
}

export interface ChapterBlock {
  id: string
  label: string
  headerY: number
  bodyY: number
  bodyHeight: number
}

export interface BranchLane {
  index: number
  sourceSceneId: string
  y: number
  height: number
}

export interface SceneConnection {
  id: string
  sourceSceneId: string
  targetSceneId: string
  isChoice: boolean
  isCrossChapter: boolean
  isConvergence: boolean
  label: string
}

export interface ChoiceOptionInfo {
  text: string
  targetCode: string
  targetSceneId: string
}

export interface SceneInfo {
  shotCount: number
  characterCount: number
  characterNames: string[]
  isChoiceScene: boolean
  isEndingScene: boolean
  isJumpTarget: boolean
  isConvergence: boolean
  convergenceSourceCount: number
  choiceOptions: ChoiceOptionInfo[]
  previewText: string
  connectionCount: { in: number; out: number }
}

export interface LayoutResult {
  positions: Map<string, CardPosition>
  chapterBlocks: ChapterBlock[]
  branchLanes: BranchLane[]
  overriddenSceneIds: Set<string>
  width: number
  height: number
}

export interface ConnectionPath {
  path: string
  labelX: number
  labelY: number
}

export interface SceneFilter {
  chapter: string | 'all'
  sceneType: 'all' | 'choice' | 'normal' | 'branch' | 'ending'
  hasCharacters: boolean
}

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  targetSceneId: string | null
}

export interface StoryFlowchartProps {
  nodes: import('@xyflow/react').Node[]
  edges: import('@xyflow/react').Edge[]
  scenes: Scene[]
  selectedSceneId: string | null
  onSelectScene: (sceneId: string) => void
  onEditScene?: (sceneId: string) => void
  onAddScene?: (chapter: string) => void
  onDeleteScene?: (sceneId: string) => void
  onRenameScene?: (sceneId: string, title: string) => void
  onAddChapter?: () => void
  chapters?: Array<{ id: string; title: string; order: number }>
}
