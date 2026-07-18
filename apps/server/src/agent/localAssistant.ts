import { analyzeStoryGraph, type StoryNode, type StoryPatch } from '@dreamchord/story-domain'
import type { AgentContextSource, AgentProjectSnapshot, AgentScope } from './context.js'
import type { AgentExecutionResult } from './executor.js'
import { answerCreativeKnowledge } from './creativeKnowledge.js'
import { lookupPublicKnowledge, type PublicKnowledgeResult } from './publicKnowledge.js'

const WRITING_INTENT = /续写|润色|改写|扩写|生成|创作|补充.*分支|写.*剧情|write|rewrite|continue/i
const EXPLICIT_REPLACEMENT_INTENT = /(?:改成|改为|替换(?:成|为)?|修改为|调整为)\s*[：:]\s*(.+)$/s
const PLAYABLE_SCENE_INTENT = /(?:根据|利用|使用)?.*(?:素材库|素材)?.*(?:创建|新建|搭建|生成|写一段).*(?:可运行|可播放|剧情场景|场景|剧情)/i
const DRAFT_TO_SCENE_INTENT = /当前对话.*(?:续写)?草稿|最近一份.*(?:续写)?草稿|草稿.*(?:工作台|场景)/i
const DEFAULT_PLAYABLE_MATERIAL = {
  backgroundId: 'bg-sakura',
  backgroundName: '樱花坡道',
  characterId: 'yuki',
  characterName: '雪',
}
const BUILT_IN_CHARACTER_NAMES: Record<string, string> = { yuki: '雪', ren: '影', miya: '宫', sora: '空', ghost: '系统幽灵' }
const MATERIAL_PROMPT_INTENT = /素材提示词|生成提示词|绘图提示词|image\s*prompt|asset\s*prompt/i
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
const STORY_ACTION_INTENT = /润色|改写|扩写|重写|补充.*分支|(新增|增加|添加|创建|新建|搭建).*(剧情|镜头|场景|分支|节点|走向)|删除.*(剧情|镜头|场景|分支)|修改.*(剧情|镜头|场景|台词)|写.*剧情|可运行|可播放|rewrite/i
const ASSET_ACTION_INTENT = /抠图|去白底|移除白底|处理.*(图片|素材|立绘|CG|背景)|转(成|为).*(立绘|CG|背景)|生成.*(立绘|CG|背景素材)/i
const MEMORY_INTENT = /你记得|记住了什么|哪些记忆|项目记忆|设定记忆/i
const CONVERSATION_RECAP_INTENT = /刚才聊了什么|刚刚聊了什么|总结.*(对话|聊天)|回顾.*(对话|聊天)|我们聊过什么/i
const PUBLIC_KNOWLEDGE_INTENT = /是什么|是什么意思|谁是|介绍一下|介绍下|解释一下|哪一年|什么是/i

export function isImmediateLocalPrompt(prompt: string): boolean {
  const value = prompt.trim()
  return MATERIAL_PROMPT_INTENT.test(value) || GREETING_INTENT.test(value) || THANKS_INTENT.test(value) || CAPABILITY_INTENT.test(value) || NEXT_STEP_INTENT.test(value) || TIME_INTENT.test(value) || DATE_INTENT.test(value)
}

export function shouldUseActionAgent(prompt: string, hasChapter: boolean): boolean {
  const value = prompt.trim()
  if (MATERIAL_PROMPT_INTENT.test(value)) return false
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

function localPlayableSceneDraft(input: {
  prompt: string
  snapshot: AgentProjectSnapshot
  chapterId?: string
  scope?: AgentScope
  targetId?: string
  continuationText?: string
}, continuation = false): AgentExecutionResult | null {
  if (input.scope === 'project' || !input.chapterId || (!continuation && !PLAYABLE_SCENE_INTENT.test(input.prompt))) return null
  const chapter = input.snapshot.chapters.find((item) => item.id === input.chapterId)
  if (!chapter) return null
  const suppliedContinuation = splitContinuationParagraphs(input.continuationText).slice(0, 20)
  const hasExternalContinuation = continuation && suppliedContinuation.length > 0
  const selectedSceneNodes = input.scope === 'scene' && input.targetId
    ? chapter.graph.nodes.filter((node) => node.data.sceneGroupId === input.targetId)
    : []
  const terminal = (selectedSceneNodes.length > 0 ? selectedSceneNodes : chapter.graph.nodes).at(-1)
  const terminalSceneId = typeof terminal?.data.sceneGroupId === 'string' ? terminal.data.sceneGroupId : ''
  const activeSceneNodes = selectedSceneNodes.length > 0
    ? selectedSceneNodes
    : terminalSceneId ? chapter.graph.nodes.filter((node) => node.data.sceneGroupId === terminalSceneId) : chapter.graph.nodes
  if (hasExternalContinuation) {
    return importedScreenplayDraft({
      snapshot: input.snapshot,
      chapter,
      terminal,
      suppliedContinuation,
    })
  }
  const background = input.snapshot.assets.find((asset) => asset.type === 'BACKGROUND') ?? input.snapshot.assets.find((asset) => asset.type === 'CG')
  const referencedBackground = [...activeSceneNodes].reverse().find((node) => node.type === 'background' && typeof node.data.backgroundId === 'string')
  const referencedCharacters = activeSceneNodes.filter((node) => node.type === 'character' && typeof node.data.characterId === 'string')
  const sceneCast = referencedCharacters.map((node) => {
    const id = node.data.characterId as string
    const projectCharacter = input.snapshot.characters.find((character) => character.id === id)
    return { id, name: typeof node.data.role === 'string' ? node.data.role : projectCharacter?.name ?? BUILT_IN_CHARACTER_NAMES[id] ?? id, description: projectCharacter?.description ?? '' }
  })
  const continuationText = suppliedContinuation.join('\n\n')
  const matchesSceneCast = sceneCast.some((character) => continuationText.includes(character.name) || continuationText.includes(character.id))
  const textDraft = hasExternalContinuation && !matchesSceneCast
  const backgroundId = background?.url ?? (typeof referencedBackground?.data.backgroundId === 'string' ? referencedBackground.data.backgroundId : DEFAULT_PLAYABLE_MATERIAL.backgroundId)
  const lead = input.snapshot.characters[0] ?? sceneCast[0] ?? (terminal && terminal.type === 'character' && typeof terminal.data.characterId === 'string'
    ? { id: terminal.data.characterId, name: typeof terminal.data.role === 'string' ? terminal.data.role : BUILT_IN_CHARACTER_NAMES[terminal.data.characterId] ?? '主角', description: '' }
    : { id: DEFAULT_PLAYABLE_MATERIAL.characterId, name: DEFAULT_PLAYABLE_MATERIAL.characterName, description: '' })
  if (!lead) return null

  const sceneGroupId = `agent-scene-${chapter.graph.nodes.length + 1}`
  const sceneCode = nextSceneCode(chapter.graph.nodes)
  const sceneTitle = textDraft ? `文本草稿场景 ${sceneCode}` : continuation ? `续写场景 ${sceneCode}` : 'Agent 新建场景'
  const sceneFields = { sceneGroupId, sceneTitle, sceneCode }
  const continuationCards = [
    { type: 'subtitle' as const, text: `${background?.name ?? '当前章节的背景'}的画面缓缓亮起，${lead.name}停在故事的入口。` },
    { type: 'dialogue' as const, role: lead.name, text: `我得从这里开始，把“${input.snapshot.title}”的线索接下去。` },
  ]
  if (continuationCards.length === 0) {
    continuationCards.push({ type: 'subtitle', text: `${background?.name ?? '眼前的景色'}没有改变，但新的线索迫使${lead.name}重新审视刚才的选择。` })
  }
  const operations: StoryPatch['operations'] = [
    ...(!textDraft ? [
      { kind: 'addNode' as const, tempId: 'scene-background', node: { type: 'background' as const, data: { ...sceneFields, backgroundId } }, ...(terminal ? { anchor: { afterNodeId: terminal.id } } : {}) },
      { kind: 'addNode' as const, tempId: 'scene-character', node: { type: 'character' as const, data: { ...sceneFields, characterId: lead.id, action: 'show' as const, expression: 'normal', position: 'center' as const } } },
    ] : []),
    ...continuationCards.map((card, index) => ({
      kind: 'addNode' as const,
      tempId: `scene-card-${index}`,
      node: card.type === 'dialogue'
        ? { type: 'dialogue' as const, data: { ...sceneFields, role: card.role, text: card.text } }
        : { type: 'subtitle' as const, data: { ...sceneFields, text: card.text } },
      ...((textDraft && index === 0 && terminal) ? { anchor: { afterNodeId: terminal.id } } : {}),
    })),
    ...(!textDraft ? [
      { kind: 'addEdge' as const, sourceRef: 'scene-background', targetRef: 'scene-character' },
      { kind: 'addEdge' as const, sourceRef: 'scene-character', targetRef: 'scene-card-0' },
    ] : terminal ? [{ kind: 'addEdge' as const, sourceRef: terminal.id, targetRef: 'scene-card-0' }] : []),
    ...continuationCards.slice(1).map((_, index) => ({ kind: 'addEdge' as const, sourceRef: `scene-card-${index}`, targetRef: `scene-card-${index + 1}` })),
  ]
  if (!textDraft && terminal?.type === 'choice' && Array.isArray(terminal.data.choices) && typeof terminal.data.choices[0] === 'string') {
    operations.unshift({ kind: 'addEdge', sourceRef: terminal.id, targetRef: 'scene-background', sourceHandle: 'choice-0', label: terminal.data.choices[0] })
  } else if (!textDraft && terminal) {
    operations.unshift({ kind: 'addEdge', sourceRef: terminal.id, targetRef: 'scene-background' })
  }
  return {
    ...result(
      textDraft
        ? `已将续写保存为“${sceneTitle}”，其中只保留与 Agent 回复一致的正文，尚未写入章节。该草稿没有匹配到当前场景的登场角色，因此没有擅自套用立绘或背景；应用后可在工作台补充素材，再让 Agent 基于该场景继续续写。`
        : continuation
        ? `已将续写整理为“${sceneTitle}”的可运行场景草案，尚未写入章节。确认后会在工作台新建该场景，并保留背景、角色登场和可播放台词。`
        : `已基于素材“${background?.name ?? (referencedBackground ? '当前章节引用的背景' : DEFAULT_PLAYABLE_MATERIAL.backgroundName)}”和角色“${lead.name}”生成可运行场景草案，尚未写入章节。确认后会把背景、登场角色和可播放台词一起加入工作台。`,
      ['读取章节与素材库', '选用背景与登场角色', '搭建可播放的场景节点与连线', '等待用户确认写入'],
    ),
    patch: { operations },
  }
}

function splitContinuationParagraphs(value?: string): string[] {
  if (!value) return []
  return value
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

type ImportedScreenplayCard =
  | { type: 'subtitle'; text: string }
  | { type: 'dialogue'; role: string; text: string }
  | { type: 'choice'; choices: string[] }

interface ImportedScreenplayScene {
  title?: string
  location?: string
  cards: ImportedScreenplayCard[]
}

function importedScreenplayDraft(input: {
  snapshot: AgentProjectSnapshot
  chapter: AgentProjectSnapshot['chapters'][number]
  terminal?: StoryNode
  suppliedContinuation: string[]
}): AgentExecutionResult {
  const scenes = parseImportedScreenplay(input.suppliedContinuation, input.snapshot)
  const sceneCodeStart = Number(nextSceneCode(input.chapter.graph.nodes).split('-')[1] ?? 1)
  const operations: StoryPatch['operations'] = []
  let previousRef = input.terminal?.id
  let importedCards = 0
  let matchedBackgrounds = 0
  let matchedCharacters = 0
  const sceneTitles: string[] = []

  scenes.forEach((scene, sceneIndex) => {
    if (scene.cards.length === 0) return
    const sceneCode = `1-${sceneCodeStart + sceneIndex}`
    const sceneGroupId = `agent-scene-${input.chapter.graph.nodes.length + sceneIndex + 1}`
    const sceneTitle = scene.title ?? scene.location ?? `文本草稿场景 ${sceneCode}`
    sceneTitles.push(sceneTitle)
    const sceneFields = { sceneGroupId, sceneTitle, sceneCode }
    const background = matchImportedBackground(scene.location, input.snapshot)
    const shownCharacterIds = new Set<string>()
    let firstRef: string | undefined
    let lastRef: string | undefined
    let cardIndex = 0
    const appendNode = (tempId: string, node: Extract<StoryPatch['operations'][number], { kind: 'addNode' }>['node']) => {
      operations.push({ kind: 'addNode', tempId, node, ...(firstRef ? {} : previousRef ? { anchor: { afterNodeId: previousRef } } : {}) })
      if (!firstRef) firstRef = tempId
      if (lastRef) operations.push({ kind: 'addEdge', sourceRef: lastRef, targetRef: tempId })
      lastRef = tempId
    }

    if (background) {
      const backgroundRef = `import-${sceneIndex}-background`
      appendNode(backgroundRef, { type: 'background', data: { ...sceneFields, backgroundId: background.url } })
      matchedBackgrounds += 1
    }

    for (const card of scene.cards) {
      if (card.type === 'dialogue') {
        const character = findImportedCharacter(card.role, input.snapshot)
        if (character && !shownCharacterIds.has(character.id)) {
          const characterRef = `import-${sceneIndex}-character-${shownCharacterIds.size}`
          appendNode(characterRef, {
            type: 'character',
            data: {
              ...sceneFields,
              characterId: character.id,
              action: 'show',
              expression: 'normal',
              position: shownCharacterIds.size === 0 ? 'left' : shownCharacterIds.size === 1 ? 'right' : 'center',
            },
          })
          shownCharacterIds.add(character.id)
          matchedCharacters += 1
        }
        appendNode(`import-${sceneIndex}-card-${cardIndex++}`, { type: 'dialogue', data: { ...sceneFields, role: character?.name ?? card.role, text: card.text } })
      } else if (card.type === 'choice') {
        appendNode(`import-${sceneIndex}-card-${cardIndex++}`, { type: 'choice', data: { ...sceneFields, choices: card.choices } })
      } else {
        appendNode(`import-${sceneIndex}-card-${cardIndex++}`, { type: 'subtitle', data: { ...sceneFields, text: card.text } })
      }
      importedCards += 1
    }

    if (firstRef && previousRef) {
      const previous = input.chapter.graph.nodes.find((node) => node.id === previousRef)
      if (previous?.type === 'choice' && Array.isArray(previous.data.choices) && typeof previous.data.choices[0] === 'string') {
        operations.unshift({ kind: 'addEdge', sourceRef: previousRef, targetRef: firstRef, sourceHandle: 'choice-0', label: previous.data.choices[0] })
      } else {
        operations.unshift({ kind: 'addEdge', sourceRef: previousRef, targetRef: firstRef })
      }
    }
    previousRef = lastRef ?? previousRef
  })

  const sceneCount = scenes.filter((scene) => scene.cards.length > 0).length
  const materialNote = [
    matchedBackgrounds > 0 ? `匹配 ${matchedBackgrounds} 个项目背景` : '未擅自绑定未匹配背景',
    matchedCharacters > 0 ? `识别 ${matchedCharacters} 位项目角色并补充登场卡` : '未擅自套用未匹配立绘',
  ].join('；')
  return {
    ...result(
      `已将选中的正文整理为 ${sceneCount} 个工作台场景、${importedCards} 张可编辑镜头卡（${sceneTitles.join('、')}），尚未写入章节。${materialNote}；旁白、角色台词和选项会分别进入对应卡片，草稿说明不会写入故事。`,
      ['清洗草稿中的说明与连线文字', '解析场景、旁白、台词与选项', '按项目素材和角色做精确匹配', '生成可审核补丁，等待作者确认'],
    ),
    patch: { operations },
  }
}

function parseImportedScreenplay(paragraphs: string[], snapshot: AgentProjectSnapshot): ImportedScreenplayScene[] {
  const scenes: ImportedScreenplayScene[] = []
  let current: ImportedScreenplayScene = { cards: [] }
  const pushCurrent = () => {
    if (current.cards.length > 0) scenes.push(current)
  }
  const startScene = (title?: string) => {
    pushCurrent()
    current = { title, cards: [] }
  }
  const addMarkedLine = (value: string) => {
    const labels = [...value.matchAll(/【([^】]{1,30})】/g)]
    if (labels.length === 0) return false
    for (let index = 0; index < labels.length; index += 1) {
      const label = labels[index]![1].trim()
      const start = (labels[index]!.index ?? 0) + labels[index]![0].length
      const end = index + 1 < labels.length ? (labels[index + 1]!.index ?? value.length) : value.length
      const text = cleanScreenplayText(value.slice(start, end))
      if (!text) continue
      if (label === '地点') {
        current.location = text
        if (!current.title) current.title = text
        current.cards.push({ type: 'subtitle', text })
      } else if (label === '场景') {
        current.title = text
      } else if (label === '旁白' || label === '画面' || label === '动作' || label === '音效') {
        current.cards.push({ type: 'subtitle', text })
      } else if (label === '选项') {
        const choices = text.split(/[／/]|\s+[|｜]\s+|[；;]/).map((item) => item.trim().replace(/^[-•\d.、]+/, '')).filter(Boolean).slice(0, 12)
        if (choices.length > 0) current.cards.push({ type: 'choice', choices })
      } else if (isScreenplayRole(label)) {
        current.cards.push({ type: 'dialogue', role: normalizeImportedRole(label, snapshot), text })
      }
    }
    return true
  }

  for (const paragraph of paragraphs) {
    const lines = paragraph.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    for (let index = 0; index < lines.length; index += 1) {
      const value = lines[index]!
      if (isDraftScaffoldLine(value) || /^[（(]\s*注[：:]/.test(value)) continue
      const shot = /\*\*镜头\s*(?:\d+|[一二三四五六七八九十]+)[^*]*\*\*/i.exec(value)
      if (shot) {
        startScene()
        const rest = value.slice((shot.index ?? 0) + shot[0].length).trim()
        if (rest) addMarkedLine(rest)
        continue
      }
      const title = sceneTitleFromLine(value)
      if (title) {
        startScene(title)
        continue
      }
      if (addMarkedLine(value)) continue
      const narrator = /^(?:旁白|narration)\s*[：:]\s*(.+)$/i.exec(value)
      if (narrator) {
        current.cards.push({ type: 'subtitle', text: narrator[1].trim() })
        continue
      }
      const dialogue = /^\s*(?:\*\*)?([^*【[（(：:\n]{1,40}?)(?:\*\*)?\s*(?:[（(]([^）)]*)[）)])?\s*[：:]\s*(.*)$/u.exec(value)
      if (dialogue) {
        const [, rawRole, rawAction, inlineText] = dialogue
        let text = inlineText.trim()
        if (!text && lines[index + 1] && !sceneTitleFromLine(lines[index + 1]!) && !isDraftScaffoldLine(lines[index + 1]!)) {
          text = lines[++index]!.trim()
        }
        if (text) {
          current.cards.push({ type: 'dialogue', role: normalizeImportedRole(rawRole.trim(), snapshot), text: rawAction?.trim() ? `（${rawAction.trim()}）\n${text}` : text })
          continue
        }
      }
      const text = cleanScreenplayText(value)
      if (text) current.cards.push({ type: 'subtitle', text })
    }
  }
  pushCurrent()
  return scenes.length > 0 ? scenes : [{ cards: [{ type: 'subtitle', text: '未识别到可导入正文。' }] }]
}

function normalizeImportedRole(role: string, snapshot: AgentProjectSnapshot): string {
  if (role !== '主角' && role !== '关键人物') return role
  const lead = snapshot.characters[0]?.name
  const counterpart = snapshot.characters.find((character) => character.name !== lead)?.name
  return role === '主角' ? lead ?? role : counterpart ?? role
}

function findImportedCharacter(role: string, snapshot: AgentProjectSnapshot) {
  return snapshot.characters.find((character) => character.name === role || character.id === role)
}

function matchImportedBackground(location: string | undefined, snapshot: AgentProjectSnapshot) {
  if (!location) return undefined
  const normalizedLocation = location.replace(/[\s【】、，。！!？?]/g, '').toLowerCase()
  return snapshot.assets.find((asset) => {
    if (asset.type !== 'BACKGROUND' && asset.type !== 'CG') return false
    const normalizedName = asset.name.replace(/[\s【】、，。！!？?]/g, '').toLowerCase()
    return normalizedName === normalizedLocation || normalizedName.includes(normalizedLocation) || normalizedLocation.includes(normalizedName)
  })
}

function isDraftScaffoldLine(value: string): boolean {
  const normalized = value.replace(/\*\*/g, '').trim()
  return /^(?:[-—]{3,}|`?node-[\w-]+\s*(?:→|->)|(?:续写|剧情)草稿\s*[：:]|镜头卡草案|连线(?:说明|草案)?|好的，?(?:我|以下)|以下(?:是|为).*(?:草案|镜头卡)|你可以在审阅后|如果你确认这个方向|所有新镜头)/.test(normalized)
}

function isScreenplayRole(label: string): boolean {
  return !['地点', '画面', '旁白', '选项', '音效', '镜头', '动作', '场景'].includes(label.trim())
}

function cleanScreenplayText(value: string): string {
  return value
    .replace(/\*\*镜头\s*[^*]+\*\*/gi, '')
    .replace(/\*\*/g, '')
    .replace(/【(?:地点|画面|旁白|选项|音效|镜头|动作|场景)】/g, '')
    .replace(/^[：:\s-]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function sceneTitleFromLine(value: string): string | undefined {
  const bracketed = /^【\s*(?:场景|scene)\s*[：:]\s*(.+?)\s*】$/i.exec(value)
  const plain = /^(?:场景|scene)\s*(?:[一二三四五六七八九十\d]+)?\s*[：:]\s*(.+)$/i.exec(value)
  const title = bracketed?.[1] ?? plain?.[1]
  return title?.trim().slice(0, 60) || undefined
}

function latestConversationDraft(sources: AgentContextSource[]): string | undefined {
  for (const source of [...sources].reverse()) {
    if (source.kind !== 'conversation-history' && source.kind !== 'conversation-summary') continue
    const text = source.content.replace(/^Agent[：:]\s*/, '').trim()
    if (text.length >= 20) return text
  }
  return undefined
}

function selectedDraftFromPrompt(prompt: string): string | undefined {
  const match = prompt.match(/【已选草稿】\s*([\s\S]*?)\s*【草稿结束】/)
  const draft = match?.[1]?.trim()
  return draft && draft.length >= 20 ? draft : undefined
}

function materialPromptPlan(snapshot: AgentProjectSnapshot, chapterId?: string): AgentExecutionResult {
  const chapter = snapshot.chapters.find((item) => item.id === chapterId)
  const backgroundAssets = snapshot.assets.filter((asset) => asset.type === 'BACKGROUND' || asset.type === 'CG')
  const lead = snapshot.characters[0]
  const storyContext = [snapshot.title, snapshot.description, chapter?.title].filter(Boolean).join('，')
  const reusable = [
    ...backgroundAssets.slice(0, 3).map((asset) => `- ${asset.name}（${asset.type === 'BACKGROUND' ? '背景' : 'CG'}）`),
    ...snapshot.characters.slice(0, 3).map((character) => `- ${character.name}（角色${character.description ? `：${character.description}` : ''}）`),
  ]
  const characterDescription = lead?.description || '主角，表情克制而有明确情绪层次'
  const characterName = lead?.name || '主角'
  return result(
    [
      `可复用素材（可在工作台直接选用）：\n${reusable.length ? reusable.join('\n') : '当前素材库没有可复用条目。'}`,
      '',
      '背景提示词',
      `视觉小说背景，${storyContext || '悬疑叙事'}，夜晚港口的叙事空间，前景、中景、远景层次清楚，电影感光影，环境细节能承载线索，16:9，1920x1080，无人物，无文字。`,
      '',
      '立绘提示词',
      `${characterName}，${characterDescription}，日系视觉小说角色立绘，全身，正面或微侧身，中性待机姿势，轮廓完整，边缘干净，透明 PNG，1024x1536。`,
      '',
      'CG 提示词',
      `${characterName}在关键剧情瞬间与港口线索互动，构图聚焦人物动作与关键物件，叙事感强，电影级视觉小说 CG，16:9，1920x1080，无文字。`,
      '',
      '负面提示词',
      'watermark, text, logo, UI, extra limbs, malformed hands, cropped body, duplicate character, busy background, low resolution, blur。',
      '',
      '导入方式：背景图导入“素材库 > 背景”；立绘请使用透明 PNG 后导入“素材库 > 角色立绘”；CG 导入“素材库 > CG”。导入后可让我基于这些素材搭建可运行场景。',
    ].join('\n'),
    ['读取项目设定、当前章节和素材库', '列出可复用素材', '生成可复制的背景、立绘与 CG 提示词'],
    ['要直接使用现有素材，可说“利用素材库创建可运行场景”', '新素材导入后，可让我把它们自动接入工作台'],
  )
}

function nextSceneCode(nodes: AgentProjectSnapshot['chapters'][number]['graph']['nodes']): string {
  const sceneNumbers = nodes.flatMap((node) => {
    const code = typeof node.data.sceneCode === 'string' ? node.data.sceneCode : ''
    const match = /^(\d+)-(\d+)$/.exec(code)
    return match && match[1] === '1' ? [Number(match[2])] : []
  })
  const unnumberedGroups = new Set(nodes
    .filter((node) => typeof node.data.sceneGroupId === 'string' && node.data.sceneGroupId.length > 0)
    .filter((node) => !/^(\d+)-(\d+)$/.test(typeof node.data.sceneCode === 'string' ? node.data.sceneCode : ''))
    .map((node) => node.data.sceneGroupId as string))
  return `1-${Math.max(0, ...sceneNumbers) + unnumberedGroups.size + 1}`
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

function localContinuationDraft(snapshot: AgentProjectSnapshot, chapterId?: string): AgentExecutionResult {
  const chapter = snapshot.chapters.find((item) => item.id === chapterId) ?? snapshot.chapters.at(-1)
  const chapterRoles = chapter?.graph.nodes.flatMap((node) => node.type === 'dialogue' && typeof node.data.role === 'string' ? [node.data.role] : []) ?? []
  const lead = snapshot.characters[0] ?? (chapterRoles[0] ? { name: chapterRoles[0] } : undefined)
  const counterpart = snapshot.characters[1] ?? (chapterRoles.find((role) => role !== lead?.name) ? { name: chapterRoles.find((role) => role !== lead?.name)! } : undefined)
  const leadName = lead?.name ?? '主角'
  const counterpartName = counterpart?.name ?? '关键人物'
  const scene = snapshot.assets.find((asset) => asset.type === 'BACKGROUND')?.name ?? '夜色里的旧街'
  const lastNode = chapter?.graph.nodes.at(-1)
  const branch = lastNode?.type === 'choice' && Array.isArray(lastNode.data.choices) && typeof lastNode.data.choices[0] === 'string'
    ? lastNode.data.choices[0]
    : '继续追查'
  const priorLine = lastNode?.type === 'dialogue' && typeof lastNode.data.text === 'string' ? lastNode.data.text.trim() : ''
  const conflict = snapshot.description.trim() || '眼前的线索仍没有答案'
  const summary = [
    `【续写草稿】${chapter?.title ?? '下一场'}`,
    '',
    `${scene}的风声压低下来。${leadName}没有立刻离开，而是顺着“${branch}”留下的方向，重新看向那条被雨水打湿的路。${priorLine ? `刚才那句“${priorLine.slice(0, 48)}”仍在耳边。` : ''}`,
    '',
    `${leadName}：\n“如果现在放过这个细节，${conflict}就会一直停在原地。”`,
    '',
    `${counterpartName}从阴影里走出来，先看了一眼远处，再把一张折起的纸递到${leadName}面前。`,
    '',
    `${counterpartName}：\n“你可以继续问下去，但答案会让你失去一个人。”`,
    '',
    `${leadName}接过那张纸，没有马上打开。镜头停在纸角被雨水浸开的字迹上，为下一场留下新的选择。`,
  ].join('\n')
  return result(
    summary,
    ['读取当前章节的结尾与选择', '结合项目冲突和主要角色续写正文', '保留为可编辑草稿，等待用户决定是否转为场景'],
    ['可直接编辑这份草稿', '满意后点击“生成工作台场景”，再审批写入章节'],
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
  continuationText?: string
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
  if (MATERIAL_PROMPT_INTENT.test(prompt)) return materialPromptPlan(input.snapshot, input.chapterId)
  const conversationDraft = selectedDraftFromPrompt(prompt) ?? (DRAFT_TO_SCENE_INTENT.test(prompt) ? latestConversationDraft(contextSources) : undefined)
  const playableScene = localPlayableSceneDraft({ ...input, prompt, continuationText: conversationDraft }, Boolean(conversationDraft))
  if (playableScene) return playableScene
  const creativeKnowledge = answerCreativeKnowledge(prompt)
  if (creativeKnowledge) return result(creativeKnowledge, ['检索本地视觉小说创作知识', '转换为 DreamChord 操作建议'])
  if (PROJECT_SUMMARY_INTENT.test(prompt)) return projectSummary(input.snapshot)
  if (CHAPTER_SUMMARY_INTENT.test(prompt)) return chapterSummary(input.snapshot)
  if (WRITING_INTENT.test(prompt)) {
    if (input.continuationText?.trim()) {
      const continuationScene = localPlayableSceneDraft({ ...input, prompt }, true)
      if (continuationScene) return continuationScene
    }
    return localContinuationDraft(input.snapshot, input.chapterId)
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
