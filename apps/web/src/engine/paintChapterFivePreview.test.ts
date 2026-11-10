import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// The preview builder is also used directly by Node to install the private draft.
// @ts-expect-error JavaScript build script has no TypeScript declaration.
import { makePreviewGraph } from '../../../../scripts/paint-chapter-five-preview.mjs'
import { convertFlowToRuntime } from './converter'
import { createRuntimeEngine } from './runtime'

describe('chapter five private preview', () => {
  it.each([[0, '拿回稿', '接过卡片'], [1, '接过卡片', '拿回稿']])('plays branch %s and its own next-day consequence', (index, expected, other) => {
    const markdown = readFileSync(new URL('../../../../docs/story/paint/05-letter-draft.zh.md', import.meta.url), 'utf8')
    const graph = makePreviewGraph(markdown)
    const engine = createRuntimeEngine(convertFlowToRuntime('preview', '草稿', graph.nodes, graph.edges, []))
    const lines: string[] = []
    let choices = 0
    while (engine.currentScene()) {
      const scene = engine.currentScene()!
      if (scene.dialogue) lines.push(scene.dialogue.text)
      if (scene.choices?.length) { choices++; engine.choose(index) } else engine.next()
      if (lines.length > 100) throw new Error('Unexpected loop')
    }
    expect(choices).toBe(1)
    expect(lines.join('\n')).toContain(expected)
    expect(lines.join('\n')).not.toContain(other)
    expect(engine.state.variables.pc5_keepsake).toBe(index === 0 ? 'paper' : 'card')
    expect(lines.join('\n')).toContain('她把刷子洗净')
  })
})
