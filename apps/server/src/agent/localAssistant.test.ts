import { describe, expect, it, vi } from 'vitest'
import { applyStoryPatch } from '@dreamchord/story-domain'
import type { AgentProjectSnapshot } from './context.js'
import { isImmediateLocalPrompt, runLocalAssistant, shouldUseActionAgent } from './localAssistant.js'

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

  it('returns a project-grounded continuation draft without creating workbench cards', async () => {
    const result = await runLocalAssistant({ prompt: '帮我续写下一段剧情', snapshot, chapterId: 'chapter', scope: 'chapter' })

    expect(result.patch).toBeUndefined()
    expect(result.summary).toContain('雪')
    expect(result.summary).toContain('林')
    expect(result.summary).toContain('追问')
  })

  it('keeps externally drafted continuation paragraphs as ordered workbench cards', async () => {
    const result = await runLocalAssistant({
      prompt: '帮我续写下一段剧情', snapshot, chapterId: 'chapter', scope: 'chapter',
      continuationText: '雨停后，雪在码头发现一枚带着盐味的旧钥匙。\n\n她抬起头，看见林站在仓库门口，却没有靠近。',
    })

    const proseTexts = result.patch?.operations.flatMap((operation) => operation.kind === 'addNode' && operation.node.type === 'subtitle' ? [operation.node.data.text] : []) ?? []
    expect(proseTexts).toEqual([
      '雨停后，雪在码头发现一枚带着盐味的旧钥匙。',
      '她抬起头，看见林站在仓库门口，却没有靠近。',
    ])
    expect(result.patch?.operations.some((operation) => operation.kind === 'addNode' && operation.node.type === 'dialogue')).toBe(false)
  })

  it('turns labelled continuation dialogue into matching dialogue cards', async () => {
    const result = await runLocalAssistant({
      prompt: '续写当前场景', snapshot, chapterId: 'chapter', scope: 'chapter',
      continuationText: '**林宇**（递出旧画册）：\n“我一直在等你回来。”\n\n**林晚**：\n“这一次，我不会再离开。”',
    })

    expect(result.patch?.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '林宇', text: expect.stringContaining('我一直在等你回来') }) }) }),
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '林晚', text: expect.stringContaining('这一次，我不会再离开') }) }) }),
    ]))
  })

  it('keeps line-based screenplay dialogue and narration as separate matching workbench cards', async () => {
    const result = await runLocalAssistant({
      prompt: '将用户正文转为可编辑工作台场景。\n\n【已选草稿】\n【场景：雨夜车站】\n林宇：等雨停了，我们就出发。\n林晚（攥紧车票）：我知道。\n雨声盖过广播，月台尽头的灯依次熄灭。\n【草稿结束】',
      snapshot, chapterId: 'chapter', scope: 'chapter',
    })

    const cards = result.patch?.operations.flatMap((operation) => operation.kind === 'addNode' && (operation.node.type === 'dialogue' || operation.node.type === 'subtitle')
      ? [{ type: operation.node.type, data: operation.node.data }]
      : []) ?? []
    expect(cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '林宇', text: '等雨停了，我们就出发。' }) }),
      expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '林晚', text: expect.stringContaining('攥紧车票') }) }),
      expect.objectContaining({ type: 'subtitle', data: expect.objectContaining({ text: '雨声盖过广播，月台尽头的灯依次熄灭。' }) }),
    ]))
  })

  it('does not turn model headings, graph links, or review notes into story cards', async () => {
    const result = await runLocalAssistant({
      prompt: '根据用户选择的续写草稿创建工作台场景。\n\n【已选草稿】\n好的，以下延续场景的镜头卡草案。\n---\n**镜头卡草案**\n`node-8 → node-9`（出现选项分歧）\n林：\n“门后传来列车声。”\n\n雪没有回头，只把钥匙攥得更紧。\n\n你可以在审阅后将其加入当前场景。\n【草稿结束】',
      snapshot, chapterId: 'chapter', scope: 'chapter',
    })

    const cards = result.patch?.operations.flatMap((operation) => operation.kind === 'addNode' && (operation.node.type === 'dialogue' || operation.node.type === 'subtitle')
      ? [operation.node]
      : []) ?? []
    expect(cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '林', text: expect.stringContaining('列车声') }) }),
      expect.objectContaining({ type: 'subtitle', data: expect.objectContaining({ text: expect.stringContaining('钥匙') }) }),
    ]))
    expect(cards.some((card) => JSON.stringify(card).includes('node-8'))).toBe(false)
    expect(cards.some((card) => JSON.stringify(card).includes('审阅后'))).toBe(false)
  })

  it('converts labelled screenplay prose and multiple character beats into clean workbench cards', async () => {
    const result = await runLocalAssistant({
      prompt: '根据用户选择的续写草稿创建工作台场景。\n\n【已选草稿】\n好的，我基于已有分支继续续写。\n\n**镜头 14** 【地点】旧书店诗歌区 【画面】苏然看着林晓恍惚的神情，没有追问。\n【苏然】“想不起来也没关系。” 【林晓】（内心）“他说下次见面，好像这句话四年前也说过。”\n【草稿结束】',
      snapshot, chapterId: 'chapter', scope: 'chapter',
    })

    const cards = result.patch?.operations.flatMap((operation) => operation.kind === 'addNode' && (operation.node.type === 'dialogue' || operation.node.type === 'subtitle')
      ? [operation.node]
      : []) ?? []
    expect(cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'subtitle', data: expect.objectContaining({ text: expect.stringContaining('旧书店诗歌区') }) }),
      expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '苏然', text: expect.stringContaining('想不起来') }) }),
      expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '林晓', text: expect.stringContaining('四年前') }) }),
    ]))
    expect(cards.some((card) => JSON.stringify(card).includes('镜头 14'))).toBe(false)
    expect(cards.some((card) => JSON.stringify(card).includes('【地点】'))).toBe(false)
  })

  it('imports a multi-shot screenplay into ordered scene groups without copying draft instructions', async () => {
    const result = await runLocalAssistant({
      prompt: '将用户正文转为可编辑工作台场景。\n\n【已选草稿】\n续写草稿：第一章重逢。\n**镜头 1** 【地点】夜晚港口\n【旁白】雨停后，雾从码头漫上来。\n【雪】我终于找到这封信了。\n\n**镜头 2** 【地点】夜晚港口\n【林】先别打开，它不该在这里出现。\n【选项】追问信的来历 / 暂时收起信件\n【草稿结束】',
      snapshot,
      chapterId: 'chapter',
      scope: 'chapter',
    })

    const addedNodes = result.patch?.operations.flatMap((operation) => operation.kind === 'addNode' ? [operation.node] : []) ?? []
    const sceneGroups = new Set(addedNodes.map((node) => node.data.sceneGroupId))
    expect(sceneGroups.size).toBe(2)
    expect(addedNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'background', data: expect.objectContaining({ backgroundId: '/uploads/harbor.png' }) }),
      expect.objectContaining({ type: 'character', data: expect.objectContaining({ characterId: 'snow', action: 'show' }) }),
      expect.objectContaining({ type: 'character', data: expect.objectContaining({ characterId: 'lin', action: 'show' }) }),
      expect.objectContaining({ type: 'subtitle', data: expect.objectContaining({ text: '雨停后，雾从码头漫上来。' }) }),
      expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '雪', text: '我终于找到这封信了。' }) }),
      expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '林', text: '先别打开，它不该在这里出现。' }) }),
      expect.objectContaining({ type: 'choice', data: expect.objectContaining({ choices: ['追问信的来历', '暂时收起信件'] }) }),
    ]))
    expect(JSON.stringify(addedNodes)).not.toContain('续写草稿')
    const applied = applyStoryPatch(snapshot.chapters[0].graph, result.patch!, (() => `generated-${Math.random()}`))
    expect(applied.validation.valid).toBe(true)
  })

  it('creates a text draft instead of assigning an unrelated default sprite to an external continuation', async () => {
    const result = await runLocalAssistant({
      prompt: '续写当前场景', chapterId: 'chapter', scope: 'scene', targetId: 'opening',
      continuationText: '林晚在陌生的车站门口停下。\n\n林宇从雨幕里走来，却没有叫她的名字。',
      snapshot: {
        ...snapshot,
        characters: [],
        assets: [],
        chapters: [{
          ...snapshot.chapters[0],
          graph: {
            nodes: [
              { id: 'bg', type: 'background', position: { x: 0, y: 0 }, data: { backgroundId: 'bg-sakura', sceneGroupId: 'opening', sceneTitle: '樱花树下' } },
              { id: 'yuki', type: 'character', position: { x: 0, y: 100 }, data: { characterId: 'yuki', action: 'show', expression: 'normal', sceneGroupId: 'opening', sceneTitle: '樱花树下' } },
            ], edges: [],
          },
        }],
      },
    })

    expect(result.summary).toContain('文本草稿场景')
    expect(result.patch?.operations.some((operation) => operation.kind === 'addNode' && operation.node.type === 'character')).toBe(false)
    expect(result.patch?.operations.some((operation) => operation.kind === 'addNode' && operation.node.type === 'subtitle' && operation.node.data.text.includes('林晚'))).toBe(true)
    expect(result.patch?.operations.some((operation) => operation.kind === 'addEdge' && operation.targetRef === 'scene-background')).toBe(false)
  })

  it('turns the latest conversation continuation into the requested workbench draft instead of inventing a new generic scene', async () => {
    const result = await runLocalAssistant({
      prompt: '根据当前对话中最近一份续写草稿，创建可编辑的工作台场景。', snapshot, chapterId: 'chapter', scope: 'chapter',
      contextSources: [{ id: 'message:draft', kind: 'conversation-history', title: '最近对话', content: 'Agent：林晚在车站门口停下。\n\n林宇从雨幕里走来。', nodeIds: [] }],
    })

    expect(result.summary).toContain('文本草稿场景')
    expect(result.patch?.operations.some((operation) => operation.kind === 'addNode' && operation.node.type === 'subtitle' && operation.node.data.text.includes('林宇'))).toBe(true)
  })

  it('uses the explicitly selected draft instead of a newer unrelated conversation message', async () => {
    const result = await runLocalAssistant({
      prompt: '根据用户选择的续写草稿创建工作台场景。\n\n【已选草稿】\n林宇：\n“等雨停了，我们就出发。”\n\n林晚没有回答，只把车票攥得更紧。\n【草稿结束】',
      snapshot, chapterId: 'chapter', scope: 'chapter',
      contextSources: [{ id: 'message:newer', kind: 'conversation-history', title: '最近对话', content: 'Agent：这是一条不应被导入的说明文字。', nodeIds: [] }],
    })

    expect(result.patch?.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '林宇', text: expect.stringContaining('等雨停了') }) }) }),
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'subtitle', data: expect.objectContaining({ text: expect.stringContaining('车票') }) }) }),
    ]))
  })

  it('creates copyable background and character prompts for a requested new scene material set', async () => {
    const result = await runLocalAssistant({ prompt: '为下一段续写生成背景和角色立绘素材提示词', snapshot, chapterId: 'chapter', scope: 'chapter' })

    expect(result.patch).toBeUndefined()
    expect(result.summary).toContain('背景提示词')
    expect(result.summary).toContain('立绘提示词')
    expect(result.summary).toContain('透明 PNG')
    expect(result.summary).toContain('负面提示词')
  })

  it('routes an explicit material-prompt request through the deterministic local assistant', () => {
    expect(isImmediateLocalPrompt('素材策略：仅生成背景、角色立绘和 CG 的素材提示词；不要创建或修改工作台剧情。\n搭建下一段剧情')).toBe(true)
  })

  it('keeps automatic material reuse on the playable-scene path', async () => {
    const prompt = '素材策略：优先复用当前项目素材库中可用的背景和角色；素材不足时，说明缺少的背景、立绘或 CG 类型。\n根据当前章节和素材库，创建一个可运行的剧情场景。'
    expect(isImmediateLocalPrompt(prompt)).toBe(false)
    const result = await runLocalAssistant({ prompt, snapshot, chapterId: 'chapter', scope: 'chapter' })
    expect(result.patch).toBeDefined()
  })

  it('builds an approval-ready playable scene from project assets without an API key', async () => {
    const result = await runLocalAssistant({
      prompt: '根据当前章节、故事设定和素材库，创建一个可运行的剧情场景，并先生成可审批补丁。',
      snapshot,
      chapterId: 'chapter',
      scope: 'chapter',
    })

    expect(result.patch?.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'background', data: expect.objectContaining({ backgroundId: '/uploads/harbor.png' }) }) }),
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'character', data: expect.objectContaining({ characterId: 'snow' }) }) }),
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '雪' }) }) }),
    ]))
    expect(result.summary).toContain('可运行场景草案')
  })

  it('does not reuse a scene code occupied by older Agent scenes', async () => {
    const result = await runLocalAssistant({
      prompt: '根据当前章节创建一个可运行的剧情场景',
      snapshot: {
        ...snapshot,
        chapters: [{
          ...snapshot.chapters[0],
          graph: {
            nodes: [
              { id: 'opening', type: 'dialogue', position: { x: 0, y: 0 }, data: { sceneGroupId: 'opening', sceneCode: '1-1', role: '雪', text: '开场' } },
              { id: 'old-agent-a', type: 'subtitle', position: { x: 0, y: 120 }, data: { sceneGroupId: 'agent-scene-10', sceneCode: 'AGENT-10', text: '旧续写' } },
              { id: 'old-agent-b', type: 'subtitle', position: { x: 0, y: 240 }, data: { sceneGroupId: 'agent-scene-14', sceneCode: 'AGENT-14', text: '旧续写二' } },
            ],
            edges: [],
          },
        }],
      },
      chapterId: 'chapter',
      scope: 'chapter',
    })

    expect(result.patch?.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ data: expect.objectContaining({ sceneCode: '1-4' }) }) }),
    ]))
  })

  it('reuses material IDs already referenced by the chapter when global library assets are not duplicated in project storage', async () => {
    const result = await runLocalAssistant({
      prompt: '根据当前章节和素材库创建一个可运行的剧情场景',
      snapshot: {
        ...snapshot,
        assets: [],
        characters: [],
        chapters: [{
          ...snapshot.chapters[0],
          graph: {
            nodes: [
              { id: 'background', type: 'background', position: { x: 0, y: 0 }, data: { backgroundId: 'bg-sakura', sceneGroupId: 'opening' } },
              { id: 'character', type: 'character', position: { x: 320, y: 0 }, data: { characterId: 'character-yuki', role: '雪', sceneGroupId: 'opening' } },
            ],
            edges: [{ id: 'opening-edge', source: 'background', target: 'character', animated: false }],
          },
        }],
      },
      chapterId: 'chapter',
      scope: 'chapter',
    })

    expect(result.patch?.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'background', data: expect.objectContaining({ backgroundId: 'bg-sakura' }) }) }),
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'character', data: expect.objectContaining({ characterId: 'character-yuki' }) }) }),
    ]))
  })

  it('uses the built-in global material library when an empty project has no local assets yet', async () => {
    const result = await runLocalAssistant({
      prompt: '根据当前章节、故事设定和素材库，创建一个可运行的剧情场景，并先生成可审批补丁。',
      snapshot: { ...snapshot, assets: [], characters: [] },
      chapterId: 'chapter',
      scope: 'chapter',
    })

    expect(result.patch?.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'background', data: expect.objectContaining({ backgroundId: 'bg-sakura' }) }) }),
      expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'character', data: expect.objectContaining({ characterId: 'yuki' }) }) }),
    ]))
  })

  it('routes a material-aware playable scene request through the action Agent when a model is configured', () => {
    expect(shouldUseActionAgent('根据素材库创建一个可运行的剧情场景', true)).toBe(true)
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

  it('keeps local continuation usable without asking for an API key', async () => {
    const result = await runLocalAssistant({ prompt: '帮我续写下一段剧情', snapshot, chapterId: 'chapter' })

    expect(result.summary).toContain('雪')
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
