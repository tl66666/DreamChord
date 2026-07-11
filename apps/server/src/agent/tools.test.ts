import { describe, expect, it } from 'vitest'
import { AGENT_TOOL_NAMES, createAgentToolRegistry } from './tools.js'

describe('creative agent tools', () => {
  it('exposes only the fixed tool allowlist', () => {
    expect(AGENT_TOOL_NAMES).toEqual([
      'read_project_brief', 'read_chapter_outline', 'read_scene', 'search_story',
      'analyze_story_graph', 'create_story_patch', 'validate_story_patch',
    ])
  })

  it('runs deterministic graph analysis', async () => {
    const registry = createAgentToolRegistry({
      snapshot: {
        projectId: 'p', title: '故事', description: '', bible: null, characters: [],
        chapters: [{ id: 'c', title: '第一章', version: 1, graph: {
          nodes: [{ id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: { choices: ['A'] } }], edges: [],
        } }],
      },
      chapterId: 'c',
    })

    const result = await registry.analyze_story_graph.execute({})
    expect(JSON.stringify(result)).toContain('choice-exit-missing')
  })
})
