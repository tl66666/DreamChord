import type { Edge, Node } from '@xyflow/react'
import { loadLibraryCharacters } from '../../lib/libraryData'
import {
  buildStoryItems, chainEdges, compareSceneCode, findCommonMerge, findNormalTarget, findStartNode,
  getChapterFromSceneCode, getChoiceBranches, getMainTail, getNodeChapter, getNodeCharacterId,
  getNodeData, getNodeDisplayLabel, getNodeSceneCode, getNodeSceneGroupId, getSceneGroupNodes,
  layoutNodes, normalEdge, resolveExpression, storyItemHasChapter, storyItemHasSceneGroup,
} from '../sceneGraph'

export {
  buildStoryItems, chainEdges, compareSceneCode, findCommonMerge, findNormalTarget, findStartNode,
  getChapterFromSceneCode, getChoiceBranches, getMainTail, getNodeChapter, getNodeDisplayLabel,
  getSceneGroupNodes, layoutNodes, normalEdge, storyItemHasChapter, storyItemHasSceneGroup,
}
import { LENS_LABEL } from './workbenchConstants'
import type { LensType, SceneCharacterDraft, SceneDraft, StoryItem } from './workbenchTypes'









export function getChoices(node: Node) {
  const data = getNodeData(node)
  const choices = Array.isArray(data.choices) ? (data.choices as string[]) : []
  return choices.length > 0 ? choices : ['继续']
}

export function getSceneCode(nodes: Node[]) {
  return nodes[0] ? getNodeSceneCode(nodes[0]) : '1-1'
}



export function getChapterOptions(nodes: Node[]) {
  const counts = new Map<string, number>()
  const seenScenes = new Set<string>()
  nodes.forEach((node) => {
    const sceneGroupId = getNodeSceneGroupId(node)
    const chapter = getNodeChapter(node)
    if (!sceneGroupId || !chapter || seenScenes.has(sceneGroupId)) return
    seenScenes.add(sceneGroupId)
    counts.set(chapter, (counts.get(chapter) || 0) + 1)
  })

  const sorted = Array.from(counts.entries()).sort(([a], [b]) => Number(a) - Number(b))
  if (sorted.length === 0) return [{ id: '1', label: '第 1 章', count: 0 }]
  return sorted.map(([id, count]) => ({ id, label: `第 ${id} 章`, count }))
}



export function getSceneOutline(nodes: Node[], edges: Edge[]) {
  const outline: Array<{ sceneGroupId: string; code: string; chapter: string; lensType: LensType; title: string; characterCount: number; preview: string }> = []
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
    const firstCharacter = draft.characters[0]
    const character = firstCharacter ? loadLibraryCharacters().find((item) => item.id === firstCharacter.characterId) : undefined
    outline.push({
      sceneGroupId,
      code: draft.sceneCode,
      chapter: getChapterFromSceneCode(draft.sceneCode),
      lensType: draft.lensType,
      title: character ? `${character.name} · ${LENS_LABEL[draft.lensType]}` : LENS_LABEL[draft.lensType],
      characterCount: draft.characters.length,
      preview: draft.text,
    })
  })

  return outline.sort((a, b) => compareSceneCode(a.code, b.code))
}


export function ensureSceneCode(draft: SceneDraft, nodes: Node[], preferredChapter = '1'): SceneDraft {
  if (draft.sceneCode.trim()) return draft
  const existingSceneNumbers = nodes
    .map((node) => getNodeSceneCode(node))
    .filter((sceneCode) => getChapterFromSceneCode(sceneCode) === preferredChapter)
    .map((sceneCode) => Number(sceneCode.split('-')[1]))
    .filter((value) => Number.isFinite(value))
  const nextScene = Math.max(0, ...existingSceneNumbers) + 1
  return { ...draft, sceneCode: `${preferredChapter}-${nextScene}` }
}


export function getSceneOptions(nodes: Node[], edges: Edge[]) {
  const options: Array<{ nodeId: string; label: string }> = []
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
    const draft = draftFromSceneNodes(getSceneGroupNodes(node, nodes, edges))
    options.push({ nodeId: node.id, label: `场景 ${draft.sceneCode}` })
  })
  return options
}


export function draftFromSceneNodes(sceneNodes: Node[]): SceneDraft {
  const backgroundNode = sceneNodes.find((node) => node.type === 'background')
  const textNode = sceneNodes.find((node) => node.type === 'dialogue' || node.type === 'subtitle')
  const characterNodes = sceneNodes.filter((node) => node.type === 'character')
  const backgroundData = getNodeData(backgroundNode)
  const textData = getNodeData(textNode)
  const lensType = String(textData.lensType || (textNode?.type === 'subtitle' ? 'narration' : 'dialogue')) as LensType
  const speakerRole = textNode?.type === 'subtitle' ? String(textData.role || '旁白') : String(textData.role || '旁白')
  const speakerCharacter = characterNodes.find((node) => getNodeCharacterId(node) === speakerRole)
  const speakerData = getNodeData(speakerCharacter)
  return {
    sceneCode: getSceneCode(sceneNodes),
    lensType,
    backgroundId: String(backgroundData.backgroundId || '/assets/backgrounds/bg-classroom.png'),
    characters: characterNodes.map((node) => {
      const data = getNodeData(node)
      return {
        characterId: String(data.characterId || 'yuki'),
        expression: String(data.expression || 'normal'),
        position: (String(data.position || 'center') as SceneCharacterDraft['position']),
        action: (String(data.action || 'show') as SceneCharacterDraft['action']),
      }
    }),
    speakerRole,
    speakerExpression: String(speakerData.expression || 'normal'),
    speakerPosition: (String(speakerData.position || 'left') as SceneDraft['speakerPosition']),
    autoStageSpeaker: true,
    text: String(textData.text || ''),
  }
}

export function positionLabel(position: SceneCharacterDraft['position']) {
  return ({ left: '左', center: '中', right: '右' } as Record<SceneCharacterDraft['position'], string>)[position]
}

export function createSceneNodes(draft: SceneDraft, reuseGroupId?: string): Node[] {
  const preparedDraft = normalizedSceneDraft(draft)
  const stamp = Date.now()
  const sceneGroupId = reuseGroupId || `scene-${stamp}-${Math.random().toString(36).slice(2, 6)}`
  const sceneCode = preparedDraft.sceneCode || '1-1'
  const nodes: Node[] = []
  nodes.push({
    id: `scene-bg-${stamp}`,
    type: 'background',
    position: { x: 260, y: 120 },
    data: { backgroundId: preparedDraft.backgroundId, sceneGroupId, sceneCode },
  })
  preparedDraft.characters.filter((character) => character.action !== 'keep').forEach((character, index) => {
    nodes.push({
      id: `scene-character-${stamp}-${index}`,
      type: 'character',
      position: { x: 260, y: 120 + (index + 1) * 130 },
      data: {
        characterId: character.characterId,
        action: character.action === 'hide' ? 'hide' : 'show',
        expression: character.expression,
        position: character.position,
        sceneGroupId,
        sceneCode,
      },
    })
  })
  const text = preparedDraft.text.trim()
  if (text) {
    const isSubtitle = preparedDraft.lensType !== 'dialogue' && preparedDraft.lensType !== 'thought'
    const role = preparedDraft.lensType === 'thought' ? preparedDraft.speakerRole : (isSubtitle ? (preparedDraft.speakerRole === 'ghost' ? 'ghost' : '旁白') : preparedDraft.speakerRole)
    nodes.push({
      id: `scene-text-${stamp}`,
      type: isSubtitle ? 'subtitle' : 'dialogue',
      position: { x: 260, y: 120 + (preparedDraft.characters.length + 1) * 130 },
      data: isSubtitle
        ? { role, text, position: 'bottom', duration: 0, sceneGroupId, sceneCode, lensType: preparedDraft.lensType }
        : { role, text, sceneGroupId, sceneCode, lensType: preparedDraft.lensType },
    })
  }
  return nodes
}

export function normalizedSceneDraft(draft: SceneDraft): SceneDraft {
  const characters = loadLibraryCharacters()
  const preparedCharacters = draft.characters.map((character) => ({
    ...character,
    action: character.action || 'show',
    expression: resolveExpression(character.characterId, character.expression),
  }))

  if ((draft.lensType === 'dialogue' || draft.lensType === 'thought') && draft.autoStageSpeaker && draft.speakerRole !== '旁白') {
    const speakerIndex = preparedCharacters.findIndex((character) => character.characterId === draft.speakerRole)
    const speakerExpression = resolveExpression(draft.speakerRole, draft.speakerExpression)
    if (speakerIndex >= 0) {
      preparedCharacters[speakerIndex] = {
        ...preparedCharacters[speakerIndex],
        expression: speakerExpression,
        position: draft.speakerPosition,
        action: 'show',
      }
    } else if (characters.some((character) => character.id === draft.speakerRole)) {
      preparedCharacters.push({
        characterId: draft.speakerRole,
        expression: speakerExpression,
        position: draft.speakerPosition,
        action: 'show',
      })
    }
  }

  return {
    ...draft,
    characters: preparedCharacters,
  }
}


export function choiceEdge(source: string, target: string, index: number, label: string): Edge {
  return { id: `e-${source}-${target}`, source, sourceHandle: `choice-${index}`, target, label, animated: true }
}

export function removeEdge(edges: Edge[], source: string, target: string) {
  const index = edges.findIndex((edge) => edge.source === source && edge.target === target && !edge.sourceHandle)
  if (index >= 0) edges.splice(index, 1)
}

export function isBranchInternalEdge(edge: Edge, items: StoryItem[]) {
  return items.some((item) => item.kind === 'choice' && item.branches.some((branch) => {
    const ids = new Set(branch.chain.map((node) => node.id))
    if (branch.merge) ids.add(branch.merge.id)
    return ids.has(edge.source) || ids.has(edge.target)
  }))
}

export function createNode(type: string, data: Record<string, unknown> = {}): Node {
  return {
    id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    position: { x: 260, y: 120 },
    data: { ...defaultNodeData(type), ...cleanUndefined(data) },
  }
}

export function cleanUndefined(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
}

export function defaultNodeData(type: string) {
  switch (type) {
    case 'dialogue':
      return { role: 'yuki', text: '新的台词。' }
    case 'subtitle':
      return { text: '新的旁白。', position: 'bottom', duration: 0 }
    case 'choice':
      return { choices: ['选项一', '选项二'] }
    case 'background':
      return { backgroundId: '/assets/backgrounds/bg-classroom.png' }
    case 'character':
      return { characterId: 'yuki', action: 'show', expression: 'normal', position: 'center' }
    default:
      return {}
  }
}

export function removeChoiceBranchFromGraph(choiceNode: Node, choiceIndex: number, nodes: Node[], edges: Edge[]) {
  const choices = getChoices(choiceNode)
  const nextChoices = choices.filter((_, index) => index !== choiceIndex)
  const branches = getChoiceBranches(choiceNode, nodes, edges)
  const removedBranchIds = new Set(branches[choiceIndex]?.chain.map((node) => node.id) || [])
  const nextNodes = nodes
    .filter((node) => !removedBranchIds.has(node.id))
    .map((node) => node.id === choiceNode.id
      ? { ...node, data: { ...node.data, choices: nextChoices.length > 0 ? nextChoices : ['继续'] } }
      : node)
  const nextEdges = edges
    .filter((edge) => !removedBranchIds.has(edge.source) && !removedBranchIds.has(edge.target))
    .filter((edge) => !(edge.source === choiceNode.id && edge.sourceHandle === `choice-${choiceIndex}`))
    .map((edge) => {
      if (edge.source !== choiceNode.id || !edge.sourceHandle?.startsWith('choice-')) return edge
      const index = Number(edge.sourceHandle.replace('choice-', ''))
      if (index <= choiceIndex) return edge
      const nextIndex = index - 1
      return { ...edge, id: `e-${choiceNode.id}-${edge.target}`, sourceHandle: `choice-${nextIndex}`, label: nextChoices[nextIndex] || edge.label }
    })
  return { nodes: nextNodes, edges: nextEdges }
}

export function createOpeningTemplateGraph(stamp = Date.now()): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    { id: `tpl-bg-${stamp}`, type: 'background', position: { x: 260, y: 120 }, data: { backgroundId: '/assets/backgrounds/bg-sakura.png' } },
    { id: `tpl-yuki-${stamp}`, type: 'character', position: { x: 260, y: 260 }, data: { characterId: 'yuki', action: 'show', expression: 'normal', position: 'left' } },
    { id: `tpl-opening-${stamp}`, type: 'subtitle', position: { x: 260, y: 400 }, data: { text: '樱花坡道上，雪第一次看见了只有自己能触碰的发光节点。', position: 'bottom', duration: 0 } },
    { id: `tpl-choice-${stamp}`, type: 'choice', position: { x: 260, y: 540 }, data: { choices: ['追问影的真实身份', '先去找宫确认现实'] } },
    { id: `tpl-branch-shadow-${stamp}`, type: 'dialogue', position: { x: 650, y: 690 }, data: { role: 'ren', text: '影低声说：“你看到的不是幻觉，是被删掉的世界还在呼吸。”' } },
    { id: `tpl-branch-miya-${stamp}`, type: 'dialogue', position: { x: 980, y: 690 }, data: { role: 'miya', text: '宫握着便签，困惑地看向雪：“我不知道为什么写下这句话，但它好像是给你的。”' } },
  ]
  return {
    nodes,
    edges: [
      normalEdge(nodes[0].id, nodes[1].id),
      normalEdge(nodes[1].id, nodes[2].id),
      normalEdge(nodes[2].id, nodes[3].id),
      choiceEdge(nodes[3].id, nodes[4].id, 0, '追问影的真实身份'),
      choiceEdge(nodes[3].id, nodes[5].id, 1, '先去找宫确认现实'),
    ],
  }
}


