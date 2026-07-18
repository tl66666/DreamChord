import { describe, expect, it } from 'vitest'
import { ensureLegacySceneGroups } from './flowEditorUtils'

describe('editor scene migration', () => {
  it('assigns chapter scene codes to older Agent scenes so they remain visible in the scene tree', () => {
    const nodes = ensureLegacySceneGroups([
      { id: 'opening', type: 'dialogue', position: { x: 0, y: 0 }, data: { sceneGroupId: 'opening', sceneCode: '1-1', text: '开场' } },
      { id: 'agent-bg', type: 'background', position: { x: 0, y: 120 }, data: { sceneGroupId: 'agent-scene-10', sceneCode: 'AGENT-10', backgroundId: 'bg-sakura' } },
      { id: 'agent-line', type: 'dialogue', position: { x: 0, y: 240 }, data: { sceneGroupId: 'agent-scene-10', sceneCode: 'AGENT-10', text: '续写' } },
    ])

    expect(nodes.filter((node) => node.data.sceneGroupId === 'agent-scene-10').map((node) => node.data.sceneCode)).toEqual(['1-2', '1-2'])
    expect(nodes.find((node) => node.id === 'agent-bg')?.data.sceneTitle).toBe('Agent 场景 1-2')
  })

  it('fills missing scene numbers before existing later scenes when normalizing old Agent output', () => {
    const nodes = ensureLegacySceneGroups([
      { id: 'opening', type: 'dialogue', position: { x: 0, y: 0 }, data: { sceneGroupId: 'opening', sceneCode: '1-1', text: '开场' } },
      { id: 'newer', type: 'dialogue', position: { x: 0, y: 120 }, data: { sceneGroupId: 'newer', sceneCode: '1-4', text: '新续写' } },
      { id: 'agent-a', type: 'subtitle', position: { x: 0, y: 240 }, data: { sceneGroupId: 'agent-a', sceneCode: 'AGENT-10', text: '旧续写一' } },
      { id: 'agent-b', type: 'subtitle', position: { x: 0, y: 360 }, data: { sceneGroupId: 'agent-b', sceneCode: 'AGENT-14', text: '旧续写二' } },
    ])

    expect(nodes.filter((node) => node.data.sceneGroupId === 'agent-a' || node.data.sceneGroupId === 'agent-b').map((node) => node.data.sceneCode)).toEqual(['1-2', '1-3'])
  })
})
