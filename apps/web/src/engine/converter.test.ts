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
})
