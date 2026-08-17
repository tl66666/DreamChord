import { describe, expect, it } from 'vitest'
import { sceneBlueprintSchema } from './sceneBlueprint.js'

describe('scene blueprint schema', () => {
  it('accepts a mixed narration, dialogue and choice scene', () => {
    const blueprint = sceneBlueprintSchema.parse({
      version: 1,
      title: '雨夜车站',
      location: '旧车站',
      beats: [
        { kind: 'narration', text: '雨声盖过了站台广播。', sourceLine: 1 },
        { kind: 'dialogue', speaker: '宫', text: '你终于来了。', characterId: 'miya' },
        { kind: 'choice', choices: ['走近她', '留在门口'] },
      ],
    })
    expect(blueprint.beats).toHaveLength(3)
  })

  it('rejects empty beats and unsupported beat kinds', () => {
    expect(() => sceneBlueprintSchema.parse({ version: 1, title: '空场景', beats: [] })).toThrow()
    expect(() => sceneBlueprintSchema.parse({ version: 1, title: '错误', beats: [{ kind: 'camera', text: 'x' }] })).toThrow()
  })
})
