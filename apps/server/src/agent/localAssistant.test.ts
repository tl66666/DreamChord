import { describe, expect, it, vi } from 'vitest'
import type { AgentProjectSnapshot } from './context.js'
import { isImmediateLocalPrompt, runLocalAssistant } from './localAssistant.js'

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
  it('summarizes a project without an external model', async () => {
    const result = await runLocalAssistant({ prompt: '概括一下整个项目', snapshot })
    expect(result.summary).toContain('雾港来信')
    expect(result.summary).toContain('1 个章节')
    expect(result.summary).toContain('2 个角色')
    expect(result.patch).toBeUndefined()
  })

  it('lists reusable assets and explains image preparation', async () => {
    const result = await runLocalAssistant({ prompt: '素材库里有什么，白底图怎么处理？', snapshot })
    expect(result.summary).toContain('夜晚港口')
    expect(result.summary).toContain('雪立绘')
    expect(result.summary).toContain('透明 PNG')
    expect(result.summary).toContain('白底')
  })

  it('lists project characters', async () => {
    const result = await runLocalAssistant({ prompt: '这个故事有哪些角色？', snapshot })
    expect(result.summary).toContain('雪')
    expect(result.summary).toContain('冷静的调查者')
    expect(result.summary).toContain('林')
  })

  it('runs deterministic chapter health analysis', async () => {
    const result = await runLocalAssistant({ prompt: '检查当前章节的问题', snapshot, chapterId: 'chapter' })
    expect(result.summary).toContain('第一章')
    expect(result.summary).toContain('choice-exit-missing')
    expect(result.patch).toBeUndefined()
  })

  it('returns a safe local writing outline instead of failing without a model', async () => {
    const result = await runLocalAssistant({ prompt: '帮我续写下一段剧情', snapshot, chapterId: 'chapter' })
    expect(result.summary).toContain('本地结构草案')
    expect(result.suggestions.join('')).toContain('外部模型')
    expect(result.patch).toBeUndefined()
  })

  it('creates an approval-ready patch for an explicit replacement on a selected dialogue card', async () => {
    const result = await runLocalAssistant({
      prompt: '把这句台词改成：我已经知道答案了。',
      snapshot: {
        ...snapshot,
        chapters: [{
          ...snapshot.chapters[0],
          graph: {
            nodes: [{ id: 'dialogue', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: '雪', text: '别再追问了。' } }],
            edges: [],
          },
        }],
      },
      chapterId: 'chapter',
      scope: 'card',
      targetId: 'dialogue',
    })

    expect(result.patch).toEqual({ operations: [{ kind: 'updateNode', nodeId: 'dialogue', changes: { text: '我已经知道答案了。' } }] })
    expect(result.summary).toContain('尚未写入')
  })

  it('answers a greeting naturally in the current project', async () => {
    const result = await runLocalAssistant({ prompt: '你好', snapshot })

    expect(result.summary).toContain('DreamChord 创作 Agent')
    expect(result.summary).toContain('《雾港来信》')
    expect(result.summary).not.toContain('当前共有')
  })

  it('explains its project-aware capabilities and safety boundary', async () => {
    const result = await runLocalAssistant({ prompt: '你能做什么？', snapshot })

    expect(result.summary).toContain('项目上下文')
    expect(result.summary).toContain('分层记忆')
    expect(result.summary).toContain('工具')
    expect(result.summary).toContain('确认')
  })

  it('responds to thanks without repeating the project inventory', async () => {
    const result = await runLocalAssistant({ prompt: '谢谢，辛苦了', snapshot })

    expect(result.summary).toContain('不客气')
    expect(result.summary).not.toContain('当前共有')
  })

  it('recommends concrete next steps from project state', async () => {
    const result = await runLocalAssistant({ prompt: '我下一步该做什么？', snapshot })

    expect(result.summary).toContain('《雾港来信》')
    expect(result.summary).toContain('剧情结构')
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions.length).toBeLessThanOrEqual(3)
  })

  it('answers the current time locally without calling a model', async () => {
    const result = await runLocalAssistant({
      prompt: '现在几点',
      snapshot,
      now: new Date('2026-07-12T10:47:00.000Z'),
    })

    expect(isImmediateLocalPrompt('现在几点')).toBe(true)
    expect(result.summary).toContain('18:47')
    expect(result.summary).toContain('北京时间')
    expect(result.patch).toBeUndefined()
  })

  it('states the offline boundary for unrelated open questions instead of repeating inventory', async () => {
    const result = await runLocalAssistant({ prompt: '一个无法查询的开放问题', snapshot, lookupKnowledge: async () => null })

    expect(result.summary).toContain('模型')
    expect(result.summary).toContain('项目')
    expect(result.summary).not.toContain('当前共有 1 个章节')
  })

  it('explains visual-novel craft terms locally with an actionable editor suggestion', async () => {
    const result = await runLocalAssistant({ prompt: '蒙太奇是什么？', snapshot })

    expect(result.summary).toContain('蒙太奇')
    expect(result.summary).toContain('镜头')
    expect(result.summary).toContain('DreamChord')
    expect(result.summary).not.toContain('不能可靠回答')
  })

  it('lists chapter facts without requiring an external model', async () => {
    const result = await runLocalAssistant({ prompt: '这个项目有哪些章节？', snapshot })

    expect(result.summary).toContain('第一章')
    expect(result.summary).toContain('1 个节点')
    expect(result.summary).not.toContain('不能可靠回答')
  })

  it('returns a project-aware local continuation outline instead of only asking for an API key', async () => {
    const result = await runLocalAssistant({ prompt: '帮我续写下一段剧情', snapshot, chapterId: 'chapter' })

    expect(result.summary).toContain('本地结构草案')
    expect(result.summary).toContain('雾港来信')
    expect(result.summary).toMatch(/雪|林/)
    expect(result.summary).not.toContain('需要配置外部模型后才能')
    expect(result.patch).toBeUndefined()
  })

  it('answers from active memories already visible to the current conversation', async () => {
    const result = await runLocalAssistant({
      prompt: '你记得这个项目的什么设定？',
      snapshot,
      contextSources: [{ id: 'memory:clue', kind: 'memory', title: '相关记忆', content: '蓝色信封只能在雨夜打开。', nodeIds: [] }],
    })

    expect(result.summary).toContain('蓝色信封')
    expect(result.plan.join('')).toContain('记忆')
  })

  it('recaps the recent conversation without an external model', async () => {
    const result = await runLocalAssistant({
      prompt: '我们刚才聊了什么？',
      snapshot,
      contextSources: [{ id: 'message:1', kind: 'conversation-history', title: '最近对话', content: '用户：想让雪先隐瞒港口钥匙。', nodeIds: [] }],
    })

    expect(result.summary).toContain('港口钥匙')
    expect(result.summary).toContain('最近')
  })

  it('uses the public knowledge lookup for ordinary factual questions and cites the source', async () => {
    const lookupKnowledge = vi.fn(async () => ({
      title: '量子纠缠',
      extract: '量子纠缠是一种量子力学现象。',
      sourceUrl: 'https://zh.wikipedia.org/wiki/%E9%87%8F%E5%AD%90%E7%BA%A0%E7%BC%A0',
    }))

    const result = await runLocalAssistant({ prompt: '量子纠缠是什么意思？', snapshot, lookupKnowledge })

    expect(lookupKnowledge).toHaveBeenCalledWith('量子纠缠是什么意思？')
    expect(result.summary).toContain('量子力学现象')
    expect(result.summary).toContain('zh.wikipedia.org')
    expect(result.plan.join('')).toContain('公共知识')
  })
})
