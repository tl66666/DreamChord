import { describe, expect, it } from 'vitest'
import { createRuntimeEngine } from './runtime'
import type { RuntimeStory } from './types'

function statefulStory(): RuntimeStory {
  return {
    id: 'stateful',
    title: 'Stateful story',
    version: '1',
    initialState: {
      nodeCount: 3,
      realityVersion: 0,
      constantNodeLocked: false,
      characters: { yuki: 'normal', ren: 'normal', miya: 'normal', sora: 'normal', ghost: 'normal' },
      activeUIEvents: [],
      variables: {},
    },
    scenes: [
      {
        id: 'choice', event: 'ON_BRANCH_SELECT', background: '/room.png',
        choices: ['承认恐惧', '选择重写', '交还选择'],
        choiceTargets: ['echo', 'echo', 'echo'],
        choiceEffects: [
          [{ kind: 'setVariable', variable: 'authorStance', value: 'fear' }],
          [{ kind: 'setVariable', variable: 'authorStance', value: 'rewrite' }],
          [{ kind: 'setVariable', variable: 'authorStance', value: 'agency' }],
        ],
      },
      {
        id: 'echo', event: 'ON_NODE_VISUALIZE', background: '/room.png',
        dialogue: { role: 'ghost', text: '选择正在产生回响。' },
        conditionalTargets: [
          { variable: 'authorStance', operator: '==', value: 'fear', target: 'fear' },
          { variable: 'authorStance', operator: '==', value: 'rewrite', target: 'rewrite' },
        ],
        nextSceneId: 'agency',
      },
      { id: 'fear', event: 'ON_NODE_VISUALIZE', background: '/room.png', dialogue: { role: 'ren', text: '你终于承认害怕。' }, nextSceneId: null },
      { id: 'rewrite', event: 'ON_NODE_VISUALIZE', background: '/room.png', dialogue: { role: 'miya', text: '先保留修改历史。' }, nextSceneId: null },
      { id: 'agency', event: 'ON_NODE_VISUALIZE', background: '/room.png', dialogue: { role: 'sora', text: '这次让我自己回答。' }, nextSceneId: null },
    ],
  }
}

describe('runtime story variables', () => {
  it('applies the selected effect before entering its target', () => {
    const engine = createRuntimeEngine(statefulStory())
    expect(engine.choose(2)).toBe(true)
    expect(engine.state.variables.authorStance).toBe('agency')
    expect(engine.currentScene()?.id).toBe('echo')
  })

  it('uses saved variables when resolving a later conditional route', () => {
    const engine = createRuntimeEngine(statefulStory())
    engine.choose(1)
    expect(engine.next()).toBe(true)
    expect(engine.currentScene()?.id).toBe('rewrite')
  })
})
