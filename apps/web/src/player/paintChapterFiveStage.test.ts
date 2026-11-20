import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { PAINT_CHAPTER_FIVE } from '@dreamchord/story-domain'
import { resolveStageStateAfterNode } from '../editor/workbench/storyEditorGraph'

describe('fifth chapter next-day staging', () => {
  const nodes = PAINT_CHAPTER_FIVE.graph.nodes as Node[]
  const edges = PAINT_CHAPTER_FIVE.graph.edges as Edge[]

  it('brings Xia and Ye into the daytime shop before the paper-line dialogue', () => {
    const stage = resolveStageStateAfterNode(nodes, edges, 'pc5-paper-day')
    expect(stage.backgroundId).toBe('/assets/paint-chapter-five/shop-letter.webp')
    expect(stage.characters.map(c => c.characterId).sort()).toEqual(['夏禾', '许野'].sort())
  })

  it('moves the card-line apology to the next day and shows its recipient', () => {
    const stage = resolveStageStateAfterNode(nodes, edges, 'pc5-card-day')
    expect(stage.backgroundId).toBe('/assets/paint-chapter-five/shop-letter.webp')
    expect(stage.characters.map(c => c.characterId)).toEqual(['许野'])
  })
})
