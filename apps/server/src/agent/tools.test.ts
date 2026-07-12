import { describe, expect, it } from 'vitest'
import { AGENT_TOOL_NAMES, createAgentToolRegistry } from './tools.js'

describe('creative agent tools', () => {
  it('exposes only the fixed tool allowlist', () => {
    expect(AGENT_TOOL_NAMES).toEqual([
      'read_project_brief', 'read_chapter_outline', 'read_scene', 'search_story',
      'read_conversation_context', 'search_memories', 'list_project_assets', 'inspect_asset', 'read_character_profile',
      'analyze_story_graph', 'create_story_patch', 'validate_story_patch',
      'prepare_character_asset', 'prepare_cg_asset', 'prepare_background_asset',
    ])
  })

  it('runs deterministic graph analysis', async () => {
    const registry = createAgentToolRegistry({
      snapshot: {
        projectId: 'p', title: '故事', description: '', bible: null, characters: [], assets: [],
        chapters: [{ id: 'c', title: '第一章', version: 1, graph: {
          nodes: [{ id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: { choices: ['A'] } }], edges: [],
        } }],
      },
      chapterId: 'c',
    })

    const result = await registry.analyze_story_graph.execute({})
    expect(JSON.stringify(result)).toContain('choice-exit-missing')
  })

  it('creates only a proposed asset artifact through preparation tools', async () => {
    const proposed: string[] = []
    const registry = createAgentToolRegistry({
      snapshot: { projectId: 'p', title: '故事', description: '', bible: null, characters: [], assets: [{ id: 'asset', name: '原图', type: 'CG', url: '/uploads/a.png', width: 100, height: 200 }], chapters: [{ id: 'c', title: '第一章', version: 1, graph: { nodes: [], edges: [] } }] },
      chapterId: 'c', conversationContext: [], memories: [],
      prepareAsset: async (assetId, purpose) => { proposed.push(`${assetId}:${purpose}`); return { id: 'variant', status: 'proposed' } },
    })
    await registry.prepare_character_asset.execute({ assetId: 'asset', removeWhite: true, trim: true })
    expect(proposed).toEqual(['asset:sprite'])
  })

  it('uses the owned pixel inspector instead of guessing from snapshot metadata', async () => {
    const registry = createAgentToolRegistry({
      snapshot: { projectId: 'p', title: '故事', description: '', bible: null, characters: [], assets: [{ id: 'asset', name: '原图', type: 'CG', url: '/uploads/a.png', width: 100, height: 200 }], chapters: [{ id: 'c', title: '第一章', version: 1, graph: { nodes: [], edges: [] } }] },
      chapterId: 'c',
      inspectAsset: async (assetId) => ({ asset: { id: assetId }, analysis: { background: 'flat-light', recommendedPurpose: 'sprite', confidence: 0.92 } }),
    })
    await expect(registry.inspect_asset.execute({ assetId: 'asset' })).resolves.toMatchObject({
      analysis: { background: 'flat-light', recommendedPurpose: 'sprite' },
    })
  })

  it('supports project read tools without a chapter and blocks story mutation tools', async () => {
    const snapshot = {
      projectId: 'p', title: '全局故事', description: '项目简介', bible: null, characters: [],
      assets: [{ id: 'asset', name: '共享背景', type: 'BACKGROUND', url: '/uploads/a.png', width: 1920, height: 1080 }],
      chapters: [{ id: 'c', title: '第一章', version: 1, graph: { nodes: [], edges: [] } }],
    }
    const registry = createAgentToolRegistry({ snapshot } as Parameters<typeof createAgentToolRegistry>[0])

    await expect(registry.read_project_brief.execute({})).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'project', title: '全局故事' }),
    ]))
    await expect(registry.list_project_assets.execute({})).resolves.toEqual([
      expect.objectContaining({ id: 'asset' }),
    ])
    await expect(registry.analyze_story_graph.execute({})).rejects.toThrow('请选择章节后再修改剧情')
  })
})
