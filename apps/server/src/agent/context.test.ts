import { describe, expect, it } from 'vitest'
import { buildInitialContext, type AgentProjectSnapshot } from './context.js'

const nodes = Array.from({ length: 12 }, (_, index) => ({
  id: `n${index}`,
  type: 'dialogue' as const,
  position: { x: 0, y: index * 100 },
  data: { role: index === 6 ? 'yuki' : '旁白', text: `台词 ${index}`, sceneGroupId: index < 8 ? 'scene-a' : 'scene-b' },
}))

const snapshot: AgentProjectSnapshot = {
  assets: [],
  projectId: 'project',
  title: '梦弦',
  description: '节点视觉小说',
  bible: {
    worldSummary: '节点会改写现实', themes: ['选择'], styleGuide: '克制', timelineRules: '', forbiddenElements: [],
    characterNotes: {
      yuki: { goal: '保护同伴', secret: '删除过节点', voice: '简短', relations: '信任宫' },
      ren: { goal: '找到真相', secret: '来自旧版本', voice: '冷静', relations: '观察雪' },
    },
  },
  characters: [
    { id: 'yuki', name: '雪', description: '主角' },
    { id: 'ren', name: '影', description: '引导者' },
  ],
  chapters: [{ id: 'chapter', title: '第一章', version: 1, graph: { nodes, edges: [] } }],
}

describe('buildInitialContext', () => {
  it('limits card scope to the selected card and four neighbors on each side', () => {
    const sources = buildInitialContext(snapshot, { scope: 'card', chapterId: 'chapter', targetId: 'n6' })
    const scene = sources.find((source) => source.kind === 'scene')

    expect(scene?.nodeIds).toHaveLength(9)
    expect(scene?.nodeIds).toEqual(['n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'])
  })

  it('only includes character secrets for characters referenced by selected content', () => {
    const sources = buildInitialContext(snapshot, { scope: 'card', chapterId: 'chapter', targetId: 'n6' })
    const characterSources = sources.filter((source) => source.kind === 'character')

    expect(characterSources.map((source) => source.id)).toEqual(['character:yuki'])
    expect(characterSources[0]?.content).toContain('删除过节点')
  })

  it('uses an outline instead of full scene text for chapter scope', () => {
    const sources = buildInitialContext(snapshot, { scope: 'chapter', chapterId: 'chapter' })

    expect(sources.some((source) => source.kind === 'chapter-outline')).toBe(true)
    expect(sources.some((source) => source.kind === 'scene')).toBe(false)
  })
})
