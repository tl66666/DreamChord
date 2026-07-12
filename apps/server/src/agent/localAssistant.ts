import { analyzeStoryGraph } from '@dreamchord/story-domain'
import type { AgentProjectSnapshot } from './context.js'
import type { AgentExecutionResult } from './executor.js'

const WRITING_INTENT = /续写|润色|改写|扩写|生成|创作|补充.*分支|写.*剧情|write|rewrite|continue/i
const ASSET_INTENT = /素材|图片|立绘|CG|背景|白底|抠图|asset|image/i
const CHARACTER_INTENT = /角色|人物|character/i
const HEALTH_INTENT = /体检|检查|问题|结构|分支|health|analy[sz]e/i

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

export function runLocalAssistant(input: { prompt: string; snapshot: AgentProjectSnapshot; chapterId?: string }): AgentExecutionResult {
  const prompt = input.prompt.trim()
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
