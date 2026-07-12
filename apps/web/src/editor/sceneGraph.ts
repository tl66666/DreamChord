/**
 * sceneGraph.ts — 场景图核心算法
 *
 * 从 WorkbenchPanel.tsx 提取的所有图算法，统一类型定义，
 * 供 SceneTree / ShotCardEditor / MiniPreview / FlowEditor 共享。
 */

import type { Node, Edge } from '@xyflow/react'
import { loadLibraryCharacters } from '../lib/libraryData'

// ============================================================
// 类型定义
// ============================================================

export type LensType = 'dialogue' | 'narration' | 'thought' | 'memory' | 'system'

export interface CharacterSlot {
  characterId: string
  expression: string
  position: 'left' | 'center' | 'right'
  action: 'show' | 'hide' | 'change' | 'keep'
}

export interface ChoiceOption {
  text: string
  targetSceneId?: string
  action: 'new_branch' | 'jump' | 'merge'
}

export interface ShotCard {
  id: string
  sceneId: string
  type: 'dialogue' | 'choice' | 'narration' | 'subtitle'
  lensType: LensType
  background: string
  characters: CharacterSlot[]
  speaker: string
  speakerExpression: string
  speakerPosition: 'left' | 'center' | 'right'
  autoStageSpeaker: boolean
  text: string
  choices?: string[]
  sceneCode: string
  sceneGroupId: string
  /** 关联的节点 ID 列表（读取时填充） */
  nodeIds: string[]
}

export function applyStageToShotCard(card: ShotCard, stage: {
  backgroundId: string
  characters: Array<{ characterId: string; expression: string; position: CharacterSlot['position']; action?: CharacterSlot['action'] }>
}): ShotCard {
  const events = new Map(card.characters.map((character) => [character.characterId, character]))
  const onStage = stage.characters.map((character): CharacterSlot => {
    const event = events.get(character.characterId)
    if (event && event.action !== 'hide') return event
    return { ...character, action: 'keep' }
  })
  const leaving = card.characters.filter((character) => character.action === 'hide')
  return {
    ...card,
    background: stage.backgroundId || card.background,
    characters: [...onStage, ...leaving],
  }
}

export interface Scene {
  id: string
  code: string
  chapter: string
  title: string
  backgroundId: string
  nodeIds: string[]
  cardCount: number
  preview: string
}

export interface ChapterInfo {
  id: string
  label: string
  sceneCount: number
}

export interface BranchInfo {
  index: number
  label: string
  start?: Node
  chain: Node[]
  merge?: Node
}

export type StoryItem =
  | { kind: 'node'; node: Node }
  | { kind: 'choice'; node: Node; branches: BranchInfo[]; merge?: Node }

// ============================================================
// 常量
// ============================================================

export const NODE_LABEL: Record<string, string> = {
  dialogue: '对话',
  subtitle: '旁白',
  choice: '选项',
  background: '背景',
  character: '角色',
  transition: '转场',
  delay: '等待',
  condition: '条件',
  setVariable: '变量',
  jump: '跳转',
}

export const LENS_TYPES: Array<{ id: LensType; label: string; desc: string }> = [
  { id: 'dialogue', label: '角色对话', desc: '角色登场、换表情并说话' },
  { id: 'narration', label: '旁白', desc: '叙述动作、环境和剧情推进' },
  { id: 'thought', label: '心理描写', desc: '角色内心独白，可带立绘状态' },
  { id: 'memory', label: '回忆镜头', desc: '插入过去片段、闪回或梦境' },
  { id: 'system', label: '系统提示', desc: 'Meta 提示、节点异常和界面信息' },
]

export const LENS_LABEL: Record<LensType, string> = Object.fromEntries(
  LENS_TYPES.map((item) => [item.id, item.label]),
) as Record<LensType, string>

// ============================================================
// 节点工具函数
// ============================================================

export function getNodeData(node: Node | undefined): Record<string, unknown> {
  if (!node) return {}
  return (node.data || {}) as Record<string, unknown>
}

export function getNodeSceneGroupId(node: Node): string {
  return String(getNodeData(node).sceneGroupId || '')
}

export function getNodeSceneCode(node: Node): string {
  return String(getNodeData(node).sceneCode || '')
}

export function getNodeSceneTitle(node: Node): string {
  return String(getNodeData(node).sceneTitle || '')
}

export function getNodeText(node: Node): string {
  return String(getNodeData(node).text || '')
}

export function getNodeCharacterId(node: Node): string {
  return String(getNodeData(node).characterId || '')
}

export function getNodeBackgroundId(node: Node): string {
  return String(getNodeData(node).backgroundId || '')
}

export function getNodeRole(node: Node): string {
  return String(getNodeData(node).role || '')
}

export function getNodeExpression(node: Node): string {
  return String(getNodeData(node).expression || 'normal')
}

export function getNodeChoices(node: Node): string[] {
  const raw = getNodeData(node).choices
  if (Array.isArray(raw)) return raw.map(String)
  return []
}

export function getNodeFlowPosition(node: Node): { x: number; y: number } | undefined {
  const fp = getNodeData(node).flowPosition
  if (fp && typeof fp === 'object' && 'x' in fp && 'y' in fp) {
    return { x: Number(fp.x), y: Number(fp.y) }
  }
  return undefined
}

/** 泛型字段访问器 — 用于不常用字段的类型安全读取 */
export function getNodeField<T>(node: Node | undefined, key: string, fallback: T): T {
  const data = getNodeData(node)
  const val = data[key]
  return val !== undefined && val !== null ? (val as T) : fallback
}

export function getChapterFromSceneCode(sceneCode: string): string {
  const chapter = sceneCode.trim().split('-')[0]
  return chapter || '1'
}

/** 将阿拉伯数字转为中文数字（支持 1-99） */
export function toChineseNumber(n: number): string {
  const numerals = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (n <= 10) return numerals[n] || String(n)
  if (n < 20) return '十' + (n % 10 === 0 ? '' : numerals[n % 10])
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return numerals[tens] + '十' + (ones === 0 ? '' : numerals[ones])
  }
  return String(n)
}

/**
 * 规范化章节标题：将标题中的阿拉伯数字替换为中文数字。
 * 如果标题无数字且不是"第X章"格式，则用 index+1 生成默认标题。
 *
 * @param title 原始章节标题
 * @param index 章节序号（0-based），仅在标题无数字时使用
 * @returns 规范化后的章节标题
 */
export function normalizeChapterTitle(title: string, index: number): string {
  const trimmed = title.trim()
  const match = trimmed.match(/\d+/)
  if (match) {
    const num = parseInt(match[0], 10)
    return trimmed.replace(/\d+/, toChineseNumber(num))
  }
  if (/^第.+章$/.test(trimmed)) {
    return trimmed
  }
  return `第${toChineseNumber(index + 1)}章`
}

export function getNodeChapter(node: Node): string {
  const sceneCode = getNodeSceneCode(node)
  return sceneCode ? getChapterFromSceneCode(sceneCode) : ''
}

export function getChoices(node: Node): string[] {
  const choices = Array.isArray(getNodeData(node).choices) ? (getNodeData(node).choices as string[]) : []
  return choices.length > 0 ? choices : ['继续']
}

export function getNodeDisplayLabel(node?: Node): string {
  if (!node) return '未知节点'
  const data = getNodeData(node)
  const sceneCode = String(data.sceneCode || '')
  const prefix = sceneCode ? `场景 ${sceneCode}` : NODE_LABEL[node.type || 'dialogue'] || node.type || '节点'
  const text = String(data.text || data.role || data.characterId || data.backgroundId || '')
  return text ? `${prefix} · ${text.slice(0, 18)}` : prefix
}

export function normalizeLibraryCharacterId(rawId: string): string {
  if (!rawId || rawId.startsWith('/uploads/') || rawId.startsWith('http')) return rawId
  const id = rawId.toLowerCase().trim()
  const characters = loadLibraryCharacters()
  if (characters.some((character) => character.id === id)) return id
  const matched = characters.find((character) => id.startsWith(`${character.id}_`))
  return matched?.id || rawId
}

export function inferExpressionFromCharacterData(rawId: string, rawExpression: string): string {
  if (rawExpression && rawExpression !== 'normal') return rawExpression
  if (!rawId || rawId.startsWith('/uploads/') || rawId.startsWith('http')) return rawExpression || 'normal'
  const normalizedId = normalizeLibraryCharacterId(rawId)
  const prefix = `${normalizedId}_`
  if (rawId.toLowerCase().startsWith(prefix)) {
    return rawId.slice(prefix.length) || rawExpression || 'normal'
  }
  return rawExpression || 'normal'
}

// ============================================================
// 图遍历算法
// ============================================================

export function findStartNode(nodes: Node[], edges: Edge[]): Node | undefined {
  const targets = new Set(edges.map((edge) => edge.target))
  return nodes.find((node) => !targets.has(node.id)) || nodes[0]
}

export function findNormalTarget(node: Node, nodes: Node[], edges: Edge[]): Node | undefined {
  const edge = edges.find((item) => item.source === node.id && !item.sourceHandle)
  return edge ? nodes.find((item) => item.id === edge.target) : undefined
}

export function findChoiceTarget(choiceNode: Node, index: number, nodes: Node[], edges: Edge[]): Node | undefined {
  const edge = edges.find((item) => item.source === choiceNode.id && item.sourceHandle === `choice-${index}`)
  return edge ? nodes.find((item) => item.id === edge.target) : undefined
}

export function buildStoryItems(nodes: Node[], edges: Edge[]): StoryItem[] {
  if (nodes.length === 0) return []
  const consumed = new Set<string>()
  const items: StoryItem[] = []
  let current: Node | undefined = findStartNode(nodes, edges)

  while (current && !consumed.has(current.id)) {
    consumed.add(current.id)
    if (current.type === 'choice') {
      const branches = getChoiceBranches(current, nodes, edges)
      const merge = findCommonMerge(branches)
      branches.forEach((branch) => branch.chain.forEach((node) => consumed.add(node.id)))
      if (merge) consumed.add(merge.id)
      items.push({ kind: 'choice', node: current, branches, merge })
      current = merge ? findNormalTarget(merge, nodes, edges) : undefined
    } else {
      items.push({ kind: 'node', node: current })
      current = findNormalTarget(current, nodes, edges)
    }
  }

  nodes.forEach((node) => {
    if (!consumed.has(node.id)) items.push({ kind: 'node', node })
  })
  return items
}

export function getChoiceBranches(choiceNode: Node, nodes: Node[], edges: Edge[]): BranchInfo[] {
  return getChoices(choiceNode).map((label, index) => {
    const start = findChoiceTarget(choiceNode, index, nodes, edges)
    const { chain, merge } = start ? walkBranch(start, nodes, edges) : { chain: [], merge: undefined }
    return { index, label, start, chain, merge }
  })
}

export function walkBranch(start: Node, nodes: Node[], edges: Edge[]) {
  const chain: Node[] = []
  const visited = new Set<string>()
  let current: Node | undefined = start
  let merge: Node | undefined

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const incomingCount = edges.filter((edge) => edge.target === current!.id).length
    if (incomingCount > 1 && chain.length > 0) {
      merge = current
      break
    }
    chain.push(current)
    const next = findNormalTarget(current, nodes, edges)
    if (next && edges.filter((edge) => edge.target === next.id).length > 1) {
      merge = next
      break
    }
    current = next
  }

  return { chain, merge }
}

export function findCommonMerge(branches: BranchInfo[]): Node | undefined {
  const mergeIds = branches.map((branch) => branch.merge?.id).filter(Boolean)
  const first = mergeIds[0]
  if (first && mergeIds.every((id) => id === first)) {
    return branches.find((branch) => branch.merge?.id === first)?.merge
  }
  return branches.find((branch) => branch.merge)?.merge
}

/**
 * 检测跨场景汇合点：被 >=2 个不同源场景的出边指向首节点的场景。
 * 只统计跨场景流程边（场景内演出边被 srcScene !== tgtScene 过滤）。
 */
export function findConvergenceScenes(
  nodes: Node[], edges: Edge[], scenes: Scene[]
): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const sceneById = new Map(scenes.map(s => [s.id, s]))
  const sourceScenesByTarget = new Map<string, Set<string>>()

  edges.forEach(edge => {
    const src = nodes.find(n => n.id === edge.source)
    const tgt = nodes.find(n => n.id === edge.target)
    if (!src || !tgt) return
    const srcScene = getNodeSceneGroupId(src)
    const tgtScene = getNodeSceneGroupId(tgt)
    if (!srcScene || !tgtScene || srcScene === tgtScene) return
    const tgtSceneObj = sceneById.get(tgtScene)
    if (!tgtSceneObj || !tgtSceneObj.nodeIds.includes(tgt.id)) return
    if (tgtSceneObj.nodeIds[0] !== tgt.id) return
    if (!sourceScenesByTarget.has(tgtScene)) sourceScenesByTarget.set(tgtScene, new Set())
    sourceScenesByTarget.get(tgtScene)!.add(srcScene)
  })

  sourceScenesByTarget.forEach((srcs, tgtScene) => {
    if (srcs.size >= 2) result.set(tgtScene, Array.from(srcs))
  })
  return result
}

// ============================================================
// 场景树构建
// ============================================================

export function getSceneGroupNodes(start: Node, nodes: Node[], edges: Edge[]): Node[] {
  const sceneGroupId = getNodeSceneGroupId(start)
  const group: Node[] = []
  const visited = new Set<string>()
  let current: Node | undefined = start
  while (current && !visited.has(current.id) && getNodeSceneGroupId(current) === sceneGroupId) {
    group.push(current)
    visited.add(current.id)
    current = findNormalTarget(current, nodes, edges)
  }
  return group
}

/**
 * 找到场景的起始节点（没有来自同场景入边的节点）。
 * 比 nodes.find 更可靠：节点数组顺序不保证起始节点排在最前，
 * 尤其在 updateCard 创建新 bg/char 节点（新 ID）后，
 * 旧文本节点（保留 ID）可能排在数组更前面，导致 find 返回错误节点。
 */
export function findSceneStartNode(sceneGroupId: string, nodes: Node[], edges: Edge[]): Node | undefined {
  const sceneNodes = nodes.filter((n) => getNodeSceneGroupId(n) === sceneGroupId)
  if (sceneNodes.length === 0) return undefined
  const startNode = sceneNodes.find((node) => {
    return !edges.some((edge) => {
      if (edge.target !== node.id) return false
      const source = nodes.find((n) => n.id === edge.source)
      return source && getNodeSceneGroupId(source) === sceneGroupId
    })
  })
  return startNode || sceneNodes[0]
}

export function buildSceneList(nodes: Node[], edges: Edge[]): Scene[] {
  const scenes: Scene[] = []
  const seen = new Set<string>()

  nodes.forEach((node) => {
    const sceneGroupId = getNodeSceneGroupId(node)
    if (!sceneGroupId || seen.has(sceneGroupId)) return
    const incomingFromSameScene = edges.some((edge) => {
      if (edge.target !== node.id) return false
      const source = nodes.find((candidate) => candidate.id === edge.source)
      return source && getNodeSceneGroupId(source) === sceneGroupId
    })
    if (incomingFromSameScene) return

    seen.add(sceneGroupId)
    const groupNodes = getSceneGroupNodes(node, nodes, edges)
    const draft = draftFromSceneNodes(groupNodes)
    const sceneCode = draft.sceneCode || '1-1'
    const characters = loadLibraryCharacters()
    const firstChar = draft.characters[0]
    const charName = firstChar ? characters.find((item) => item.id === firstChar.characterId)?.name : undefined
    const customTitle = groupNodes
      .map((item) => String(getNodeData(item).sceneTitle || '').trim())
      .find(Boolean)

    scenes.push({
      id: sceneGroupId,
      code: sceneCode,
      chapter: getChapterFromSceneCode(sceneCode),
      title: customTitle || (charName ? `${charName} · ${LENS_LABEL[draft.lensType]}` : LENS_LABEL[draft.lensType]),
      backgroundId: draft.background,
      nodeIds: groupNodes.map((n) => n.id),
      cardCount: groupNodes.filter((n) => n.type === 'dialogue' || n.type === 'subtitle' || n.type === 'choice').length,
      preview: draft.text.slice(0, 40),
    })
  })

  return scenes.sort((a, b) => compareSceneCode(a.code, b.code))
}

export function buildChapterList(nodes: Node[], edges: Edge[]): ChapterInfo[] {
  const scenes = buildSceneList(nodes, edges)
  const counts = new Map<string, number>()
  const titles = new Map<string, string>()
  scenes.forEach((scene) => {
    counts.set(scene.chapter, (counts.get(scene.chapter) || 0) + 1)
  })
  // 收集每个章节的自定义标题
  nodes.forEach((node) => {
    const sceneCode = getNodeSceneCode(node)
    const chapter = getChapterFromSceneCode(sceneCode)
    const customTitle = String(getNodeData(node).chapterTitle || '').trim()
    if (customTitle) titles.set(chapter, customTitle)
  })
  const sorted = Array.from(counts.entries()).sort(([a], [b]) => Number(a) - Number(b))
  if (sorted.length === 0) return [{ id: '1', label: '第一章', sceneCount: 0 }]
  return sorted.map(([id, count]) => ({
    id,
    label: titles.get(id) || `第${toChineseNumber(Number(id))}章`,
    sceneCount: count,
  }))
}

export function compareSceneCode(a: string, b: string): number {
  const [aChapter, aScene] = a.split('-').map((value) => Number(value))
  const [bChapter, bScene] = b.split('-').map((value) => Number(value))
  if (Number.isFinite(aChapter) && Number.isFinite(bChapter) && aChapter !== bChapter) return aChapter - bChapter
  if (Number.isFinite(aScene) && Number.isFinite(bScene) && aScene !== bScene) return aScene - bScene
  return a.localeCompare(b)
}

// ============================================================
// ShotCard ↔ FlowNode 转换
// ============================================================

export function draftFromSceneNodes(sceneNodes: Node[]): ShotCard {
  const backgroundNode = sceneNodes.find((node) => node.type === 'background')
  const textNode = sceneNodes.find((node) => node.type === 'dialogue' || node.type === 'subtitle' || node.type === 'choice')
  const characterNodes = sceneNodes.filter((node) => node.type === 'character')
  const bgData = getNodeData(backgroundNode)
  const textData = getNodeData(textNode)
  const lensType = String(textData.lensType || (textNode?.type === 'subtitle' ? 'narration' : 'dialogue')) as LensType
  const speakerRole = normalizeLibraryCharacterId(textNode?.type === 'subtitle' ? String(textData.role || '旁白') : String(textData.role || '旁白'))
  const speakerCharacter = characterNodes.find((node) => normalizeLibraryCharacterId(String(getNodeData(node).characterId || '')) === speakerRole)
  const speakerData = getNodeData(speakerCharacter)
  const sceneGroupId = getNodeSceneGroupId(sceneNodes[0]!) || ''

  return {
    id: textNode?.id || `card-${Date.now()}`,
    sceneId: sceneGroupId,
    type: textNode?.type === 'choice' ? 'choice' : textNode?.type === 'subtitle' ? 'subtitle' : 'dialogue',
    lensType,
    background: String(bgData.backgroundId || ''),
    characters: characterNodes.map((node) => {
      const data = getNodeData(node)
      const rawCharacterId = String(data.characterId || 'yuki')
      return {
        characterId: normalizeLibraryCharacterId(rawCharacterId),
        expression: inferExpressionFromCharacterData(rawCharacterId, String(data.expression || 'normal')),
        position: (String(data.position || 'center') as CharacterSlot['position']),
        action: (String(data.action || 'show') as CharacterSlot['action']),
      }
    }),
    speaker: speakerRole,
    speakerExpression: String(speakerData.expression || 'normal'),
    speakerPosition: (String(speakerData.position || 'left') as ShotCard['speakerPosition']),
    autoStageSpeaker: Boolean(textData.autoStageSpeaker ?? true),
    text: String(textData.text || ''),
    choices: textNode?.type === 'choice' ? getChoices(textNode) : undefined,
    sceneCode: getNodeSceneCode(sceneNodes[0]!) || '1-1',
    sceneGroupId,
    nodeIds: sceneNodes.map((n) => n.id),
  }
}

export function ensureSceneCode(draft: ShotCard, nodes: Node[], preferredChapter = '1'): string {
  if (draft.sceneCode.trim()) return draft.sceneCode
  const existingSceneNumbers = nodes
    .map((node) => getNodeSceneCode(node))
    .filter((code) => getChapterFromSceneCode(code) === preferredChapter)
    .map((code) => Number(code.split('-')[1]))
    .filter((value) => Number.isFinite(value))
  const nextScene = Math.max(0, ...existingSceneNumbers) + 1
  return `${preferredChapter}-${nextScene}`
}

export function resolveExpression(characterId: string, expression: string): string {
  if (expression !== '__random') return expression || 'normal'
  const character = loadLibraryCharacters().find((item) => item.id === characterId)
  const expressions = character?.expressions || []
  if (expressions.length === 0) return character?.defaultExpression || 'normal'
  const index = Math.floor(Math.random() * expressions.length)
  return expressions[index]?.id || character?.defaultExpression || 'normal'
}

/**
 * 将 ShotCard 转换为 FlowNode 序列（background → characters → dialogue/choice）
 */
export function createSceneNodes(card: ShotCard, reuseGroupId?: string): { nodes: Node[]; sceneGroupId: string } {
  const stamp = Date.now()
  const rnd = Math.random().toString(36).slice(2, 6)
  const sceneGroupId = reuseGroupId || card.sceneGroupId || `scene-${stamp}-${rnd}`
  const sceneCode = card.sceneCode || '1-1'
  const nodes: Node[] = []

  // 背景节点
  nodes.push({
    id: `scene-bg-${stamp}-${rnd}`,
    type: 'background',
    position: { x: 260, y: 120 },
    data: { backgroundId: card.background, sceneGroupId, sceneCode },
  })

  // 角色节点
  const visibleCharacters = card.characters.filter((character) => character.action !== 'keep')
  visibleCharacters.forEach((character, index) => {
    nodes.push({
      id: `scene-char-${stamp}-${rnd}-${index}`,
      type: 'character',
      position: { x: 260, y: 120 + (index + 1) * 130 },
      data: {
        characterId: character.characterId,
        action: character.action === 'hide' ? 'hide' : 'show',
        expression: resolveExpression(character.characterId, character.expression),
        position: character.position,
        sceneGroupId,
        sceneCode,
      },
    })
  })

  // 文本节点
  const text = card.text
  if (card.type === 'choice') {
    nodes.push({
      id: card.id || `scene-choice-${stamp}-${rnd}`,
      type: 'choice',
      position: { x: 260, y: 120 + (visibleCharacters.length + 1) * 130 },
      data: {
        choices: card.choices || ['选项 1', '选项 2'],
        sceneGroupId,
        sceneCode,
        lensType: card.lensType,
        autoStageSpeaker: card.autoStageSpeaker ?? true,
      },
    })
  } else {
    const isSubtitle = card.lensType !== 'dialogue' && card.lensType !== 'thought'
    const role = card.lensType === 'thought'
      ? card.speaker
      : isSubtitle
        ? (card.speaker === 'ghost' ? 'ghost' : '旁白')
        : card.speaker
    nodes.push({
      id: card.id || `scene-text-${stamp}-${rnd}`,
      type: isSubtitle ? 'subtitle' : 'dialogue',
      position: { x: 260, y: 120 + (visibleCharacters.length + 1) * 130 },
      data: isSubtitle
        ? { role, text, position: 'bottom', duration: 0, sceneGroupId, sceneCode, lensType: card.lensType, autoStageSpeaker: card.autoStageSpeaker ?? true }
        : { role, text, sceneGroupId, sceneCode, lensType: card.lensType, autoStageSpeaker: card.autoStageSpeaker ?? true },
    })
  }

  return { nodes, sceneGroupId }
}

/**
 * 规范化 ShotCard：处理自动登场、表情解析
 */
export function normalizeShotCard(card: ShotCard): ShotCard {
  const characters = loadLibraryCharacters()
  const preparedCharacters = card.characters.map((character) => ({
    ...character,
    action: character.action || 'show',
    expression: resolveExpression(character.characterId, character.expression),
  }))

  if ((card.lensType === 'dialogue' || card.lensType === 'thought') && card.autoStageSpeaker && card.speaker !== '旁白') {
    const speakerIndex = preparedCharacters.findIndex((character) => character.characterId === card.speaker)
    const speakerExpression = resolveExpression(card.speaker, card.speakerExpression)
    if (speakerIndex >= 0) {
      preparedCharacters[speakerIndex] = {
        ...preparedCharacters[speakerIndex],
        expression: speakerExpression,
        position: card.speakerPosition,
        action: 'show',
      }
    } else if (characters.some((character) => character.id === card.speaker)) {
      preparedCharacters.push({
        characterId: card.speaker,
        expression: speakerExpression,
        position: card.speakerPosition,
        action: 'show',
      })
    }
  }

  return { ...card, characters: preparedCharacters }
}

// ============================================================
// 边操作工具
// ============================================================

export function normalEdge(source: string, target: string, id = `e-${source}-${target}`): Edge {
  return { id, source, target, animated: true }
}

export function choiceEdge(source: string, target: string, index: number, label: string): Edge {
  return { id: `e-${source}-${target}-choice-${index}`, source, sourceHandle: `choice-${index}`, target, label, animated: true }
}

export function chainEdges(nodes: Node[]): Edge[] {
  return nodes.slice(0, -1).map((node, index) => normalEdge(node.id, nodes[index + 1].id))
}

export function removeEdge(edges: Edge[], source: string, target: string): Edge[] {
  return edges.filter((edge) => !(edge.source === source && edge.target === target && !edge.sourceHandle))
}

// ============================================================
// 流程图位置持久化
// ============================================================

/** 读取场景在流程图中的手动定位（存储在 background 节点的 data.flowPosition） */
export function getSceneFlowPosition(sceneId: string, nodes: Node[]): { x: number; y: number } | null {
  const bg = nodes.find(n => getNodeSceneGroupId(n) === sceneId && n.type === 'background')
  if (!bg) return null
  const fp = getNodeFlowPosition(bg)
  return fp ?? null
}

/** 设置场景在流程图中的手动定位 */
export function setSceneFlowPosition(sceneId: string, pos: { x: number; y: number }, nodes: Node[]): Node[] {
  return nodes.map(n =>
    getNodeSceneGroupId(n) === sceneId && n.type === 'background'
      ? { ...n, data: { ...(n.data as object), flowPosition: pos } }
      : n
  )
}

// ============================================================
// 自动布局
// ============================================================

export function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const items = buildStoryItems(nodes, edges)
  const positioned = new Map<string, Node>()
  let y = 120

  items.forEach((item) => {
    if (item.kind === 'node') {
      positioned.set(item.node.id, { ...item.node, position: { x: 260, y } })
      y += 150
      return
    }

    positioned.set(item.node.id, { ...item.node, position: { x: 260, y } })
    const branchBaseY = y + 150
    item.branches.forEach((branch, branchIndex) => {
      const x = 650 + branchIndex * 330
      branch.chain.forEach((node, nodeIndex) => {
        positioned.set(node.id, { ...node, position: { x, y: branchBaseY + nodeIndex * 130 } })
      })
    })
    const maxBranchLength = Math.max(1, ...item.branches.map((branch) => branch.chain.length))
    if (item.merge) {
      positioned.set(item.merge.id, {
        ...item.merge,
        position: { x: 650 + Math.max(0, item.branches.length - 1) * 165, y: branchBaseY + maxBranchLength * 130 },
      })
      y = branchBaseY + maxBranchLength * 130 + 160
    } else {
      y = branchBaseY + maxBranchLength * 130 + 60
    }
  })

  return nodes.map((node) => positioned.get(node.id) || node)
}

// ============================================================
// StoryItem 辅助
// ============================================================

export function storyItemHasChapter(item: StoryItem, chapter: string): boolean {
  if (item.kind === 'node') return getNodeChapter(item.node) === chapter
  if (getNodeChapter(item.node) === chapter) return true
  if (item.merge && getNodeChapter(item.merge) === chapter) return true
  return item.branches.some((branch) => branch.chain.some((node) => getNodeChapter(node) === chapter))
}

export function storyItemHasSceneGroup(item: StoryItem, sceneGroupId: string): boolean {
  if (item.kind === 'node') return getNodeSceneGroupId(item.node) === sceneGroupId
  if (getNodeSceneGroupId(item.node) === sceneGroupId) return true
  if (item.merge && getNodeSceneGroupId(item.merge) === sceneGroupId) return true
  return item.branches.some((branch) => branch.chain.some((node) => getNodeSceneGroupId(node) === sceneGroupId))
}

export function getMainTail(items: StoryItem[], nodes: Node[]): Node | undefined {
  const last = items[items.length - 1]
  if (!last) return nodes[nodes.length - 1]
  if (last.kind === 'choice') return last.merge || last.node
  return last.node
}

// ============================================================
// 镜头卡分组工具
// ============================================================

export function hasTextNode(group: Node[]): boolean {
  return group.some((n) => n.type === 'dialogue' || n.type === 'subtitle' || n.type === 'choice')
}

export function groupNodesToCards(sceneNodes: Node[]): ShotCard[] {
  if (sceneNodes.length === 0) return []
  const cards: ShotCard[] = []
  let currentGroup: Node[] = []
  let lastBg: Node | null = null

  for (const node of sceneNodes) {
    if (node.type === 'background') {
      if (currentGroup.length > 0 && hasTextNode(currentGroup)) {
        cards.push(draftFromSceneNodes(currentGroup))
      }
      lastBg = node
      currentGroup = [node]
    } else if (node.type === 'character') {
      currentGroup.push(node)
    } else {
      currentGroup.push(node)
      cards.push(draftFromSceneNodes(currentGroup))
      currentGroup = lastBg ? [lastBg] : []
    }
  }
  if (currentGroup.length > 0 && hasTextNode(currentGroup)) {
    cards.push(draftFromSceneNodes(currentGroup))
  }

  return cards.filter((c, i, arr) => arr.findIndex((c2) => c2.id === c.id) === i)
}
