import type { Node } from '@xyflow/react'

export type WorkbenchTab = 'story' | 'characters' | 'scenes'
export type BranchInfo = { index: number; label: string; start?: Node; chain: Node[]; merge?: Node }
export type LensType = 'dialogue' | 'narration' | 'thought' | 'memory' | 'system'
export type SceneCharacterDraft = {
  characterId: string
  expression: string
  position: 'left' | 'center' | 'right'
  action?: 'show' | 'hide' | 'keep'
}
export type SceneDraft = {
  sceneCode: string
  lensType: LensType
  backgroundId: string
  characters: SceneCharacterDraft[]
  speakerRole: string
  speakerExpression: string
  speakerPosition: 'left' | 'center' | 'right'
  autoStageSpeaker: boolean
  text: string
}
export type SceneComposerTarget =
  | { kind: 'main' }
  | { kind: 'branch'; choiceNode: Node; branch: BranchInfo }
  | { kind: 'edit'; sceneGroupId: string }
export type StoryItem =
  | { kind: 'node'; node: Node }
  | { kind: 'choice'; node: Node; branches: BranchInfo[]; merge?: Node }

