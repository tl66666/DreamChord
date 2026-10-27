import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { convertFlowToRuntime } from './converter'

describe('flow runtime stage continuity', () => {
  it('keeps character state isolated between choice branches', () => {
    const nodes: Node[] = [
      { id: 'bg', type: 'background', position: { x: 0, y: 0 }, data: { backgroundId: '/room.png' } },
      { id: 'yuki', type: 'character', position: { x: 0, y: 0 }, data: { characterId: 'yuki', action: 'show', expression: 'normal', position: 'left' } },
      { id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: { choices: ['等任来', '独自离开'] } },
      { id: 'ren', type: 'character', position: { x: 0, y: 0 }, data: { characterId: 'ren', action: 'show', expression: 'serious', position: 'right' } },
      { id: 'wait', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: 'ren', text: '我来了。' } },
      { id: 'hide-yuki', type: 'character', position: { x: 0, y: 0 }, data: { characterId: 'yuki', action: 'hide', expression: 'normal', position: 'left' } },
      { id: 'leave', type: 'subtitle', position: { x: 0, y: 0 }, data: { text: '房间里空无一人。' } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'bg', target: 'yuki' },
      { id: 'e2', source: 'yuki', target: 'choice' },
      { id: 'e3', source: 'choice', target: 'ren', sourceHandle: 'choice-0' },
      { id: 'e4', source: 'ren', target: 'wait' },
      { id: 'e5', source: 'choice', target: 'hide-yuki', sourceHandle: 'choice-1' },
      { id: 'e6', source: 'hide-yuki', target: 'leave' },
    ]

    const runtime = convertFlowToRuntime('project', '分支舞台', nodes, edges)
    const wait = runtime.scenes.find((scene) => scene.id === 'wait')
    const leave = runtime.scenes.find((scene) => scene.id === 'leave')

    expect(wait?.characters?.map((character) => character.id)).toEqual(['yuki', 'ren'])
    expect(leave?.characters).toEqual([])
    expect(wait?.background).toBe('/room.png')
    expect(leave?.background).toBe('/room.png')
  })

  it('uses the current project character catalog instead of browser-local library data', () => {
    const nodes: Node[] = [
      { id: 'bg', type: 'background', position: { x: 0, y: 0 }, data: { backgroundId: '/uploads/project/room.webp' } },
      { id: 'show-hero', type: 'character', position: { x: 0, y: 0 }, data: { characterId: 'hero-01', action: 'show', expression: 'smile', position: 'center' } },
      { id: 'line', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: 'hero-01', text: 'I am available in every browser.' } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'bg', target: 'show-hero' },
      { id: 'e2', source: 'show-hero', target: 'line' },
    ]

    const runtime = convertFlowToRuntime('project', 'Custom cast', nodes, edges, [
      {
        id: 'hero-01',
        name: 'Lin',
        color: '#0ea5e9',
        defaultSprite: '/uploads/project/lin-default.webp',
        sprites: [{ name: 'smile', url: '/uploads/project/lin-smile.webp' }],
      },
    ])

    expect(runtime.scenes[0]?.characters).toEqual([
      expect.objectContaining({ id: 'hero-01', customUrl: '/uploads/project/lin-smile.webp' }),
    ])
  })

  it('carries BGM, sound effects, and voice-over direction into the playable scene', () => {
    const nodes: Node[] = [
      {
        id: 'line', type: 'dialogue', position: { x: 0, y: 0 }, data: {
          role: 'narrator', text: 'Rain begins.',
          audio: {
            bgm: { action: 'play', url: '/uploads/audio/rain.mp3', volume: 0.4, fadeInMs: 600 },
            sfx: [{ url: '/uploads/audio/thunder.ogg', volume: 0.8 }],
            voice: { url: '/uploads/audio/narration.wav', volume: 0.9 },
          },
        },
      },
    ]

    const runtime = convertFlowToRuntime('project', 'Audio direction', nodes, [])

    expect(runtime.scenes[0]?.audio).toEqual({
      bgm: { action: 'play', url: '/uploads/audio/rain.mp3', volume: 0.4, fadeInMs: 600 },
      sfx: [{ url: '/uploads/audio/thunder.ogg', volume: 0.8 }],
      voice: { url: '/uploads/audio/narration.wav', volume: 0.9 },
    })
  })

  it('compiles choice effects and chained condition nodes without blank scenes', () => {
    const nodes: Node[] = [
      {
        id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: {
          choices: ['承认恐惧', '选择重写', '交还选择'],
          effects: [
            [{ kind: 'setVariable', variable: 'authorStance', value: 'fear' }],
            [{ kind: 'setVariable', variable: 'authorStance', value: 'rewrite' }],
            [{ kind: 'setVariable', variable: 'authorStance', value: 'agency' }],
          ],
        },
      },
      { id: 'echo', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: 'ghost', text: '产生回响。' } },
      { id: 'fear?', type: 'condition', position: { x: 0, y: 0 }, data: { variable: 'authorStance', operator: '==', value: 'fear' } },
      { id: 'rewrite?', type: 'condition', position: { x: 0, y: 0 }, data: { variable: 'authorStance', operator: '==', value: 'rewrite' } },
      { id: 'fear', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: 'ren', text: '恐惧回响。' } },
      { id: 'rewrite', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: 'miya', text: '重写回响。' } },
      { id: 'agency', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: 'sora', text: '选择回响。' } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'choice', target: 'echo', sourceHandle: 'choice-0' },
      { id: 'e2', source: 'choice', target: 'echo', sourceHandle: 'choice-1' },
      { id: 'e3', source: 'choice', target: 'echo', sourceHandle: 'choice-2' },
      { id: 'e4', source: 'echo', target: 'fear?' },
      { id: 'e5', source: 'fear?', target: 'fear', sourceHandle: 'true' },
      { id: 'e6', source: 'fear?', target: 'rewrite?', sourceHandle: 'false' },
      { id: 'e7', source: 'rewrite?', target: 'rewrite', sourceHandle: 'true' },
      { id: 'e8', source: 'rewrite?', target: 'agency', sourceHandle: 'false' },
    ]

    const runtime = convertFlowToRuntime('project', '条件回响', nodes, edges)

    expect(runtime.scenes.map((scene) => scene.id)).toEqual(['choice', 'echo', 'fear', 'rewrite', 'agency'])
    expect(runtime.scenes[0]?.choiceEffects?.[2]).toEqual([
      { kind: 'setVariable', variable: 'authorStance', value: 'agency' },
    ])
    expect(runtime.scenes[1]).toMatchObject({
      conditionalTargets: [
        { variable: 'authorStance', operator: '==', value: 'fear', target: 'fear' },
        { variable: 'authorStance', operator: '==', value: 'rewrite', target: 'rewrite' },
      ],
      nextSceneId: 'agency',
    })
  })
})
