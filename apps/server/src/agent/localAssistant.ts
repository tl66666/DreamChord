import { analyzeStoryGraph } from '@dreamchord/story-domain'
import type { AgentProjectSnapshot } from './context.js'
import type { AgentExecutionResult } from './executor.js'

const WRITING_INTENT = /续写|润色|改写|扩写|生成|创作|补充.*分支|写.*剧情|write|rewrite|continue/i
const ASSET_INTENT = /素材|图片|立绘|CG|背景|白底|抠图|asset|image/i
const CHARACTER_INTENT = /角色|人物|character/i
const HEALTH_INTENT = /体检|检查|问题|结构|分支|health|analy[sz]e/i
const GREETING_INTENT = /^(你好|您好|嗨|哈喽|hello|hi)[!！。.？?]*$/i
const THANKS_INTENT = /谢谢|感谢|辛苦了|thanks?/i
const CAPABILITY_INTENT = /你是谁|你能做什么|会做什么|怎么用|如何使用|有什么能力|agent.*能力/i
const NEXT_STEP_INTENT = /下一步|接下来|从哪开始|该做什么|建议做什么/i

export function isImmediateLocalPrompt(prompt: string): boolean {
  const value = prompt.trim()
  return GREETING_INTENT.test(value) || THANKS_INTENT.test(value) || CAPABILITY_INTENT.test(value) || NEXT_STEP_INTENT.test(value)
}

function result(summary: string, plan: string[], suggestions: string[] = []): AgentExecutionResult {
  return { summary, plan, suggestions, memorySuggestions: [], artifactRefs: [], toolSteps: 0 }
}

function projectSummary(snapshot: AgentProjectSnapshot): AgentExecutionResult {
  const description = snapshot.description.trim() || '尚未填写项目简介。'
  return result(
    `${snapshot.title}：${description}\n当前共有 ${snapshot.chapters.length} 个章节、${snapshot.characters.length} 个角色、${snapshot.assets.length} 项素材。`,
    ['读取项目简介', '统计章节、角色和素材'],
    ['可以继续询问角色清单、素材清单或剧情体检'],
  )
}

function assetSummary(snapshot: AgentProjectSnapshot): AgentExecutionResult {
  const inventory = snapshot.assets.length
    ? snapshot.assets.map((asset) => `- ${asset.name}（${asset.type}${asset.width && asset.height ? `，${asset.width}x${asset.height}` : ''}）`).join('\n')
    : '素材库目前为空。'
  return result(
    `素材库共有 ${snapshot.assets.length} 项：\n${inventory}\n\n角色立绘优先使用透明 PNG；白底或纯色底图片可以先做边缘连通去底和裁边。复杂背景无法只靠本地规则可靠抠图，建议换透明 PNG 或在专业抠图工具中处理。`,
    ['盘点素材库', '给出图片处理建议'],
  )
}

function characterSummary(snapshot: AgentProjectSnapshot): AgentExecutionResult {
  const inventory = snapshot.characters.length
    ? snapshot.characters.map((character) => `- ${character.name}：${character.description || '尚未填写简介'}`).join('\n')
    : '项目中还没有角色。'
  return result(`角色清单（${snapshot.characters.length}）：\n${inventory}`, ['读取项目角色'], ['可在故事圣经中补充角色目标、秘密、语言习惯和关系'])
}

function healthSummary(snapshot: AgentProjectSnapshot, chapterId?: string): AgentExecutionResult {
  const chapters = chapterId ? snapshot.chapters.filter((chapter) => chapter.id === chapterId) : snapshot.chapters
  if (chapters.length === 0) return result('没有找到可体检的章节，请先选择或创建章节。', ['查找章节'])
  const reports = chapters.map((chapter) => ({ chapter, report: analyzeStoryGraph(chapter.graph) }))
  const issueCount = reports.reduce((sum, item) => sum + item.report.issues.length, 0)
  const details = reports.map(({ chapter, report }) => {
    const issues = report.issues.length ? report.issues.slice(0, 8).map((issue) => `${issue.code}：${issue.title}`).join('；') : '未发现结构问题'
    return `${chapter.title}：${issues}`
  }).join('\n')
  return result(`已完成${chapters.length === 1 ? chapters[0].title : '全项目'}剧情体检，共发现 ${issueCount} 项：\n${details}`, ['读取故事图', '执行确定性结构校验'], ['选择具体章节后可进一步定位问题节点'])
}

function greeting(snapshot: AgentProjectSnapshot): AgentExecutionResult {
  return result(
    `你好，我是 DreamChord 创作 Agent。现在正在和你一起处理《${snapshot.title}》。你可以直接问我剧情、角色、素材或项目结构，也可以绑定章节后让我续写并提出可审批的修改。`,
    ['识别当前项目与对话意图'],
    ['试试问“这个项目下一步该做什么？”'],
  )
}

function capabilities(snapshot: AgentProjectSnapshot): AgentExecutionResult {
  return result(
    `我会结合《${snapshot.title}》的项目上下文、最近对话和分层记忆来工作。\n\n我可以盘点角色与素材、检查剧情结构、梳理设定和创作方向；配置外部模型后还能续写、润色和补充分支。需要读取信息时我会调用受限工具，需要修改剧情或生成素材时只提交候选，必须由你确认后才会生效。`,
    ['说明上下文、记忆、工具与审批边界'],
    ['直接描述你现在卡住的地方', '绑定章节后让我检查或续写具体剧情'],
  )
}

function nextSteps(snapshot: AgentProjectSnapshot): AgentExecutionResult {
  const suggestions: string[] = []
  if (!snapshot.description.trim()) suggestions.push('先补一段项目简介，明确主角、目标和核心冲突')
  if (snapshot.characters.length === 0) suggestions.push('建立主要角色，并写清目标、秘密和语言习惯')
  if (snapshot.assets.length === 0) suggestions.push('上传一张背景和主角立绘，先跑通一个可播放场景')
  if (snapshot.chapters.length === 0) {
    suggestions.push('创建第一章和开场场景')
  } else {
    const issueCount = snapshot.chapters.reduce((total, chapter) => total + analyzeStoryGraph(chapter.graph).issues.length, 0)
    suggestions.push(issueCount > 0 ? `先处理剧情结构中的 ${issueCount} 项问题` : '选择一个章节，检查节奏后续写下一场戏')
  }
  const selected = suggestions.slice(0, 3)
  return result(
    `《${snapshot.title}》下一步建议从剧情结构和可播放闭环入手：\n${selected.map((item, index) => `${index + 1}. ${item}`).join('\n')}`,
    ['检查项目完整度', '生成优先级建议'],
    selected,
  )
}

export function runLocalAssistant(input: { prompt: string; snapshot: AgentProjectSnapshot; chapterId?: string }): AgentExecutionResult {
  const prompt = input.prompt.trim()
  if (GREETING_INTENT.test(prompt)) return greeting(input.snapshot)
  if (THANKS_INTENT.test(prompt)) return result(`不客气。关于《${input.snapshot.title}》，你可以继续直接说想完善哪一部分，我会沿用当前对话上下文。`, ['延续当前对话'])
  if (CAPABILITY_INTENT.test(prompt)) return capabilities(input.snapshot)
  if (NEXT_STEP_INTENT.test(prompt)) return nextSteps(input.snapshot)
  if (WRITING_INTENT.test(prompt)) {
    return result(
      '这项任务需要配置外部模型后才能进行续写、润色或剧情生成。本地助手不会伪造生成结果，也不会把这次对话标记为失败。',
      ['识别为生成式创作任务', '保留当前故事不变'],
      ['前往“模型设置”配置 Kimi、GLM、DeepSeek 或 OpenAI 兼容接口后重试'],
    )
  }
  if (ASSET_INTENT.test(prompt)) return assetSummary(input.snapshot)
  if (CHARACTER_INTENT.test(prompt)) return characterSummary(input.snapshot)
  if (HEALTH_INTENT.test(prompt)) return healthSummary(input.snapshot, input.chapterId)
  return projectSummary(input.snapshot)
}
