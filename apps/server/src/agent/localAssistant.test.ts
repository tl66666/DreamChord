import { describe, expect, it } from 'vitest'
import type { AgentProjectSnapshot } from './context.js'
import { runLocalAssistant } from './localAssistant.js'

const snapshot: AgentProjectSnapshot = {
  projectId: 'project',
  title: '雾港来信',
  description: '少女在旧港追查失踪的邮差。',
  bible: null,
  characters: [
    { id: 'snow', name: '雪', description: '冷静的调查者' },
    { id: 'lin', name: '林', description: '守口如瓶的邮差' },
  ],
  assets: [
    { id: 'harbor', name: '夜晚港口', type: 'BACKGROUND', url: '/uploads/harbor.png', width: 1920, height: 1080 },
    { id: 'snow-sprite', name: '雪立绘', type: 'CG', url: '/uploads/snow.png', width: 900, height: 1600 },
  ],
  chapters: [{
    id: 'chapter', title: '第一章', version: 1,
    graph: { nodes: [{ id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: { choices: ['追问'] } }], edges: [] },
  }],
}

describe('local agent assistant', () => {
  it('summarizes a project without an external model', () => {
    const result = runLocalAssistant({ prompt: '概括一下整个项目', snapshot })
    expect(result.summary).toContain('雾港来信')
    expect(result.summary).toContain('1 个章节')
    expect(result.summary).toContain('2 个角色')
    expect(result.patch).toBeUndefined()
  })

  it('lists reusable assets and explains image preparation', () => {
    const result = runLocalAssistant({ prompt: '素材库里有什么，白底图怎么处理？', snapshot })
    expect(result.summary).toContain('夜晚港口')
    expect(result.summary).toContain('雪立绘')
    expect(result.summary).toContain('透明 PNG')
    expect(result.summary).toContain('白底')
  })

  it('lists project characters', () => {
    const result = runLocalAssistant({ prompt: '这个故事有哪些角色？', snapshot })
    expect(result.summary).toContain('雪')
    expect(result.summary).toContain('冷静的调查者')
    expect(result.summary).toContain('林')
  })

  it('runs deterministic chapter health analysis', () => {
    const result = runLocalAssistant({ prompt: '检查当前章节的问题', snapshot, chapterId: 'chapter' })
    expect(result.summary).toContain('第一章')
    expect(result.summary).toContain('choice-exit-missing')
    expect(result.patch).toBeUndefined()
  })

  it('completes writing requests with model configuration guidance instead of failing', () => {
    const result = runLocalAssistant({ prompt: '帮我续写下一段剧情', snapshot, chapterId: 'chapter' })
    expect(result.summary).toContain('需要配置外部模型')
    expect(result.suggestions.join('')).toContain('模型设置')
    expect(result.patch).toBeUndefined()
  })
})
