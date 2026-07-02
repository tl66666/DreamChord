export type BuiltinCharacterId = 'yuki' | 'ren' | 'miya' | 'sora' | 'ghost'
export type CharacterId = BuiltinCharacterId | (string & {})

export type CharacterState =
  | 'normal'
  | 'smile'
  | 'surprised'
  | 'serious'
  | 'curious'
  | 'happy'
  | 'smirk'
  | 'warm'

export interface CharacterOnStage {
  id: CharacterId
  state: CharacterState
  position?: 'left' | 'center' | 'right'
  customUrl?: string
}

export type RuntimeEvent =
  | 'ON_INIT'
  | 'ON_NODE_VISUALIZE'
  | 'ON_CHARACTER_SPAWN'
  | 'ON_CONSTANT_NODE_CONTACT'
  | 'ON_NODE_CREATE'
  | 'ON_BRANCH_SELECT'
  | 'ON_REALITY_CHANGE'
  | 'ON_REALITY_SAVE'

export interface RuntimeScene {
  id: string
  event: RuntimeEvent
  eventTarget?: string
  background: string
  characters?: CharacterOnStage[]
  uiEvents?: string[]
  dialogue?: {
    role: CharacterId | string
    text: string
  }
  choices?: string[]
  choiceTargets?: (string | undefined)[]
  nextSceneId?: string | null
}

export interface WorldState {
  nodeCount: number
  realityVersion: number
  constantNodeLocked: boolean
  characters: Record<CharacterId, CharacterState>
  activeUIEvents: string[]
}

export interface RuntimeStory {
  id: string
  title: string
  version: string
  initialState: WorldState
  scenes: RuntimeScene[]
}

export interface RuntimeEngine {
  story: RuntimeStory
  state: WorldState
  sceneIndex: number
  history: RuntimeScene[]
  next: () => boolean
  choose: (index: number) => boolean
  emit: (event: RuntimeEvent, target?: string) => void
  currentScene: () => RuntimeScene | null
}
