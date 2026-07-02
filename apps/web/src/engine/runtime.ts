import type {
  RuntimeStory,
  RuntimeScene,
  WorldState,
  RuntimeEvent,
  CharacterId,
} from './types'

function cloneState(state: WorldState): WorldState {
  return {
    ...state,
    characters: { ...state.characters },
    activeUIEvents: [...state.activeUIEvents],
  }
}

export function createRuntimeEngine(story: RuntimeStory) {
  const state = cloneState(story.initialState)
  let sceneIndex = 0
  const history: RuntimeScene[] = []

  function findSceneIndex(sceneId: string): number {
    return story.scenes.findIndex((scene) => scene.id === sceneId)
  }

  function moveToScene(nextIndex: number): boolean {
    sceneIndex = nextIndex
    const nextScene = currentScene()
    if (nextScene) {
      applyScene(nextScene)
    }
    return nextScene !== null
  }

  function applyScene(scene: RuntimeScene) {
    // 应用角色状态
    if (scene.characters) {
      for (const ch of scene.characters) {
        state.characters[ch.id] = ch.state
      }
    }

    // 应用事件对世界状态的特殊影响
    switch (scene.event) {
      case 'ON_INIT':
        state.nodeCount = 0
        state.realityVersion = 0
        state.activeUIEvents = []
        break
      case 'ON_NODE_VISUALIZE':
        state.activeUIEvents = scene.uiEvents || []
        break
      case 'ON_CHARACTER_SPAWN':
        if (scene.eventTarget) {
          state.characters[scene.eventTarget as CharacterId] = 'normal'
        }
        state.activeUIEvents = scene.uiEvents || []
        break
      case 'ON_CONSTANT_NODE_CONTACT':
        state.constantNodeLocked = true
        state.activeUIEvents = scene.uiEvents || []
        break
      case 'ON_NODE_CREATE':
        state.nodeCount += 1
        state.activeUIEvents = scene.uiEvents || []
        break
      case 'ON_BRANCH_SELECT':
        state.realityVersion += 1
        state.activeUIEvents = scene.uiEvents || []
        break
      case 'ON_REALITY_CHANGE':
        state.realityVersion += 0.1
        state.activeUIEvents = scene.uiEvents || []
        break
      case 'ON_REALITY_SAVE':
        state.realityVersion = Math.max(state.realityVersion, 1.0)
        state.activeUIEvents = scene.uiEvents || []
        break
    }
  }

  function currentScene(): RuntimeScene | null {
    return story.scenes[sceneIndex] || null
  }

  function next(): boolean {
    const scene = currentScene()
    if (!scene) return false

    // 如果当前场景有选项，必须 choose 之后才能 next
    if (scene.choices && scene.choices.length > 0) {
      return false
    }

    history.push(scene)
    if (scene.nextSceneId !== undefined) {
      if (scene.nextSceneId === null) {
        return moveToScene(story.scenes.length)
      }
      const targetIndex = findSceneIndex(scene.nextSceneId)
      if (targetIndex >= 0) {
        return moveToScene(targetIndex)
      }
      return moveToScene(story.scenes.length)
    }
    return moveToScene(sceneIndex + 1)
  }

  function choose(index: number): boolean {
    const scene = currentScene()
    if (!scene || !scene.choices || index < 0 || index >= scene.choices.length) {
      return false
    }

    history.push(scene)
    const targetId = scene.choiceTargets?.[index]
    if (targetId) {
      const targetIndex = findSceneIndex(targetId)
      if (targetIndex >= 0) {
        return moveToScene(targetIndex)
      }
    }
    // 未设置目标或目标无效时，前进到下一场景
    return moveToScene(sceneIndex + 1)
  }

  function emit(event: RuntimeEvent, target?: string) {
    const scene = story.scenes.find(
      (s) => s.event === event && (!target || s.eventTarget === target),
    )
    if (scene) {
      const idx = story.scenes.indexOf(scene)
      history.push(...story.scenes.slice(sceneIndex, idx))
      sceneIndex = idx
      applyScene(scene)
    }
  }

  // 初始化第一个场景
  if (story.scenes.length > 0) {
    applyScene(story.scenes[0])
  }

  return {
    story,
    get state() {
      return state
    },
    get sceneIndex() {
      return sceneIndex
    },
    history,
    next,
    choose,
    emit,
    currentScene,
  }
}
