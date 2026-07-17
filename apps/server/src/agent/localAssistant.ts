import { analyzeStoryGraph } from '@dreamchord/story-domain'
import type { AgentContextSource, AgentProjectSnapshot, AgentScope } from './context.js'
import type { AgentExecutionResult } from './executor.js'
import { answerCreativeKnowledge } from './creativeKnowledge.js'
import { lookupPublicKnowledge, type PublicKnowledgeResult } from './publicKnowledge.js'

const WRITING_INTENT = /续写|润色|改写|扩写|生成|创作|补充.*分支|写.*剧情|write|rewrite|continue/i
const EXPLICIT_REPLACEMENT_INTENT = /(?:改成|改为|替换(?:成|为)?|修改为|调整为)\s*[：:]\s*(.+)$/s
const ASSET_INTENT = /素材|图片|立绘|CG|背景|白底|抠图|asset|image/i
const CHARACTER_INTENT = /角色|人物|character/i
const HEALTH_INTENT = /体检|检查.*(剧情|章节|结构|分支)|(剧情|章节|结构|分支).*(问题|健康)|health|analy[sz]e/i
const GREETING_INTENT = /^(你好|您好|嗨|哈喽|hello|hi)[!！。.？?]*$/i
const THANKS_INTENT = /谢谢|感谢|辛苦了|thanks?/i
const CAPABILITY_INTENT = /你是谁|你能做什么|会做什么|怎么用|如何使用|有什么能力|agent.*能力/i
const NEXT_STEP_INTENT = /下一步|接下来|从哪开始|该做什么|建议做什么/i
const TIME_INTENT = /^(现在|当前)?(是)?几点(了)?[?？。！!]*$|^(现在|当前)?时间[?？。！!]*$/i
const DATE_INTENT = /^(今天|现在|当前)(是)?(几号|什么日期|星期几|周几)[?？。！!]*$/i
const PROJECT_SUMMARY_INTENT = /概括.*项目|整个项目|项目.*(概况|简介|结构|情况)|讲讲.*项目/i
const CHAPTER_SUMMARY_INTENT = /有哪些章节|章节.*(列表|清单|情况|概况)|列出.*章节|多少.*章节/i
const STORY_ACTION_INTENT = /续写|润色|改写|扩写|重写|补充.*分支|(新增|增加|添加).*(剧情|镜头|场景|分支|节点|走向)|删除.*(剧情|镜头|场景|分支)|修改.*(剧情|镜头|场景|台词)|写.*剧情|write|rewrite|continue/i
const ASSET_ACTION_INTENT = /抠图|去白底|移除白底|处理.*(图片|素材|立绘|CG|背景)|转(成|为).*(立绘|CG|背景)|生成.*(立绘|CG|背景素材)/i
const MEMORY_INTENT = /你记得|记住了什么|哪些记忆|项目记忆|设定记忆/i
const CONVERSATION_RECAP_INTENT = /刚才聊了什么|刚刚聊了什么|总结.*(对话|聊天)|回顾.*(对话|聊天)|我们聊过什么/i
const PUBLIC_KNOWLEDGE_INTENT = /是什么|是什么意思|谁是|介绍一下|介绍下|解释一下|哪一年|什么是/i

export function isImmediateLocalPrompt(prompt: string): boolean {
  const value = prompt.trim()
  return GREETING_INTENT.test(value) || THANKS_INTENT.test(value) || CAPABILITY_INTENT.test(value) || NEXT_STEP_INTENT.test(value) || TIME_INTENT.test(value) || DATE_INTENT.test(value)
}

export function shouldUseActionAgent(prompt: string, hasChapter: boolean): boolean {
  const value = prompt.trim()
  return ASSET_ACTION_INTENT.test(value) || (hasChapter && STORY_ACTION_INTENT.test(value))
}

function result(summary: string, plan: string[], suggestions: string[] = []): AgentExecutionResult {
  return { summary, plan, suggestions, memorySuggestions: [], artifactRefs: [], toolSteps: 0 }
}

function localExplicitCardReplacement(input: {
  prompt: string
  snapshot: AgentProjectSnapshot
  chapterId?: string
  scope?: AgentScope
  targetId?: string
}): AgentExecutionResult | null {
  if (input.scope !== 'card' || !input.chapterId || !input.targetId) return null
  const replacement = input.prompt.trim().match(EXPLICIT_REPLACEMENT_INTENT)?.[1]?.trim()
  if (!replacement) return null
  const chapter = input.snapshot.chapters.find((item) => item.id === input.chapterId)
  const node = chapter?.graph.nodes.find((item) => item.id === input.targetId)
  if (!node || (node.type !== 'dialogue' && node.type !== 'subtitle') || typeof node.data.text !== 'string') return null
  return {
    ...result(
      `已为选中的${node.type === 'dialogue' ? '台词' : '旁白'}生成精确替换草案，尚未写入故事。请先核对变更预览，再选择“应用变更”。`,
      ['读取已选卡片', '提取明确替换文本', '生成可审批的结构化补丁'],
    ),
    patch: { operations: [{ kind: 'updateNode', nodeId: node.id, changes: { text: replacement } }] },
  }
}

function projectSummary(snapshot: AgentProjectSnapshot): AgentExecutionResult {
  const description = snapshot.description.trim() || '尚未填写项目简介。'
  return result(
    `${snapshot.title}：${description}\n当前共有 ${snapshot.chapters.length} 个章节、${snapshot.characters.length} 个角色、${snapshot.assets.length} 项素材。`,
    ['读取项目简介', '统计章节、角色和素材'],
    ['可以继续询问角色清单、素材清单或剧情体检'],
  )
}

function chapterSummary(snapshot: AgentProjectSnapshot): AgentExecutionResult {
  if (snapshot.chapters.length === 0) return result('这个项目还没有章节。可以先创建第一章和一个开场场景。', ['读取项目章节'])
  const chapters = snapshot.chapters.map((chapter, index) => `${index + 1}. ${chapter.title}：${chapter.graph.nodes.length} 个节点，版本 ${chapter.version}`).join('\n')
  return result(`《${snapshot.title}》共有 ${snapshot.chapters.length} 个章节：\n${chapters}`, ['读取项目章节与节点统计'], ['可以继续指定一个章节做剧情体检'])
}

function localContinuationOutline(snapshot: AgentProjectSnapshot, chapterId?: string): AgentExecutionResult {
  const chapter = snapshot.chapters.find((item) => item.id === chapterId) ?? snapshot.chapters.at(-1)
  const lead = snapshot.characters[0]
  const counterpart = snapshot.characters[1]
  const projectConflict = snapshot.description.trim() || '主角正在追查一个尚未解决的问题'
  const leadName = lead?.name ?? '主角'
  const counterpartName = counterpart?.name ?? '关键人物'
  const chapterLabel = chapter?.title ?? '下一章'
  const summary = [
    `本地结构草案（不会直接写入章节）：《${snapshot.title}》·${chapterLabel}`,
    '',
    `1. 承接：用一个短镜头确认当前目标——${projectConflict}`,
    `2. 加压：让${counterpartName}带来一条不完整线索，同时迫使${leadName}在“立刻追查”和“先保护重要关系”之间取舍。`,
    '3. 落点：在场景末尾给出一个会改变后续信息或关系的选择，并让两个选项都在下一场得到第一次反馈。',
    '',
    `示例镜头：旁白交代环境中的异常细节；${leadName}先提出一个具体问题；${counterpartName}回避核心答案，却说出一个能连接下一场的新地点或物件。`,
  ].join('\n')
  return result(
    summary,
    ['读取项目简介与章节', '选择主要角色', '生成可继续编辑的三步剧情方案'],
    ['可以直接按这个结构手动新建镜头卡', '配置外部模型后可把结构扩写成更自然的完整正文'],
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
    `我会结合《${snapshot.title}》的项目上下文、最近对话和分层记忆来工作。\n\n不配置 API Key 时，我可以盘点章节、角色与素材，检查剧情结构，回顾当前对话与记忆，解释视觉小说创作方法，并通过只读公共知识工具查询常见事实。续写请求会先给出项目相关的本地结构草案。配置外部模型后还能生成更自然的长文本和可审批剧情补丁。需要修改剧情或生成素材时只提交候选，必须由你确认后才会生效。`,
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

function currentDateTime(now: Date, dateOnly: boolean): AgentExecutionResult {
  const formatted = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(dateOnly ? { weekday: 'long' as const } : { hour: '2-digit' as const, minute: '2-digit' as const, hour12: false }),
  }).format(now)
  return result(`当前北京时间是 ${formatted}。`, ['读取当前系统时间'])
}

function offlineBoundary(snapshot: AgentProjectSnapshot): AgentExecutionResult {
  return result(
    `我没有在本地创作知识或公共知识中找到这个问题的可靠答案，也没有调用外部模型。《${snapshot.title}》的项目资料仍然可用，你可以让我列章节、盘点角色和素材、回顾对话与记忆、检查剧情结构，或把问题改成更具体的“什么是……”形式。配置模型后可以继续处理更开放的问题。`,
    ['检索本地能力', '未找到可靠答案', '保留项目数据不变'],
    ['补充一个明确的主题或专有名词', '继续询问项目、角色、素材或剧情结构'],
  )
}

function contextSummary(sources: AgentContextSource[], kind: AgentContextSource['kind'], emptyMessage: string, heading: string, plan: string): AgentExecutionResult {
  const matches = sources.filter((source) => source.kind === kind)
  if (matches.length === 0) return result(emptyMessage, [plan])
  const details = matches.slice(-6).map((source) => `- ${source.content.slice(0, 600)}`).join('\n')
  return result(`${heading}：\n${details}`, [plan])
}

function publicKnowledgeAnswer(knowledge: PublicKnowledgeResult): AgentExecutionResult {
  return result(
    `${knowledge.title}：${knowledge.extract}\n\n来源：${knowledge.sourceUrl}`,
    ['识别一般事实问题', '调用只读公共知识工具', '返回摘要与来源'],
    ['公共知识条目可能不完整，重要信息请继续核对原始来源'],
  )
}

export async function runLocalAssistant(input: {
  prompt: string
  snapshot: AgentProjectSnapshot
  chapterId?: string
  scope?: AgentScope
  targetId?: string
  now?: Date
  contextSources?: AgentContextSource[]
  lookupKnowledge?: (prompt: string) => Promise<PublicKnowledgeResult | null>
}): Promise<AgentExecutionResult> {
  const prompt = input.prompt.trim()
  const contextSources = input.contextSources ?? []
  if (GREETING_INTENT.test(prompt)) return greeting(input.snapshot)
  if (THANKS_INTENT.test(prompt)) return result(`不客气。关于《${input.snapshot.title}》，你可以继续直接说想完善哪一部分，我会沿用当前对话上下文。`, ['延续当前对话'])
  if (CAPABILITY_INTENT.test(prompt)) return capabilities(input.snapshot)
  if (NEXT_STEP_INTENT.test(prompt)) return nextSteps(input.snapshot)
  if (TIME_INTENT.test(prompt)) return currentDateTime(input.now ?? new Date(), false)
  if (DATE_INTENT.test(prompt)) return currentDateTime(input.now ?? new Date(), true)
  if (MEMORY_INTENT.test(prompt)) {
    return contextSummary(contextSources, 'memory', '当前对话没有可用的启用记忆。你可以在记忆中心确认或新增设定。', '当前对话可见的项目记忆', '读取当前项目与对话作用域内的启用记忆')
  }
  if (CONVERSATION_RECAP_INTENT.test(prompt)) {
    const histories = contextSources.filter((source) => source.kind === 'conversation-history' || source.kind === 'conversation-summary')
    if (histories.length === 0) return result('当前对话还没有足够的历史内容可以回顾。', ['读取当前对话历史'])
    return result(`最近对话回顾：\n${histories.slice(-6).map((source) => `- ${source.content.slice(0, 600)}`).join('\n')}`, ['读取当前对话历史与滚动摘要'])
  }
  const exactReplacement = localExplicitCardReplacement({ ...input, prompt })
  if (exactReplacement) return exactReplacement
  const creativeKnowledge = answerCreativeKnowledge(prompt)
  if (creativeKnowledge) return result(creativeKnowledge, ['检索本地视觉小说创作知识', '转换为 DreamChord 操作建议'])
  if (PROJECT_SUMMARY_INTENT.test(prompt)) return projectSummary(input.snapshot)
  if (CHAPTER_SUMMARY_INTENT.test(prompt)) return chapterSummary(input.snapshot)
  if (WRITING_INTENT.test(prompt)) {
    return localContinuationOutline(input.snapshot, input.chapterId)
  }
  if (ASSET_INTENT.test(prompt)) return assetSummary(input.snapshot)
  if (CHARACTER_INTENT.test(prompt)) return characterSummary(input.snapshot)
  if (HEALTH_INTENT.test(prompt)) return healthSummary(input.snapshot, input.chapterId)
  if (PUBLIC_KNOWLEDGE_INTENT.test(prompt)) {
    const knowledge = await (input.lookupKnowledge ?? lookupPublicKnowledge)(prompt)
    if (knowledge) return publicKnowledgeAnswer(knowledge)
  }
  return offlineBoundary(input.snapshot)
}
