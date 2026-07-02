/**
 * sceneInfo.ts — 场景信息计算
 *
 * 从 StoryFlowchart.tsx 提取并增强 computeSceneInfo 函数。
 * 增强：characterNames, isEndingScene, isJumpTarget, previewText, connectionCount
 */

import type { Node, Edge } from '@xyflow/react'
import type { SceneInfo, ChoiceOptionInfo } from './types'
import {
  getNodeSceneGroupId,
  getNodeData,
  getChoices,
  normalizeLibraryCharacterId,
  type Scene,
} from '../sceneGraph'
import { loadLibraryCharacters } from '../../lib/libraryData'

/**
 * 计算场景的综合信息
 *
 * @param scene 目标场景
 * @param nodes 所有节点
 * @param edges 所有边
 * @param sceneById 场景 ID 到场景的映射
 * @returns 场景信息（镜头数、角色、选项、预览等）
 */
export function computeSceneInfo(
  scene: Scene,
  nodes: Node[],
  edges: Edge[],
  sceneById: Map<string, Scene>,
  convergenceMap?: Map<string, string[]>,
): SceneInfo {
  const sceneNodes = nodes.filter((n) => getNodeSceneGroupId(n) === scene.id)
  const shotCount = scene.cardCount

  // ---------- 汇合标记 ----------
  const isConvergence = convergenceMap?.has(scene.id) ?? false
  const convergenceSourceCount = convergenceMap?.get(scene.id)?.length ?? 0

  // ---------- 角色信息 ----------
  const characterIds = new Set<string>()
  const characterNames: string[] = []
  const characters = loadLibraryCharacters()
  sceneNodes.forEach((n) => {
    if (n.type === 'character') {
      const rawId = String(getNodeData(n).characterId || '')
      if (!rawId) return
      const cid = normalizeLibraryCharacterId(rawId)
      if (!characterIds.has(cid)) {
        characterIds.add(cid)
        const char = characters.find((c: { id: string; name: string }) => c.id === cid)
        characterNames.push(char?.name || cid)
      }
    }
  })

  // ---------- 预览文本 ----------
  // 该场景第一个 dialogue/subtitle 节点的 text 字段
  const textNode = sceneNodes.find((n) => n.type === 'dialogue' || n.type === 'subtitle')
  const previewText = textNode ? String(getNodeData(textNode).text || '') : ''

  // ---------- 跳转目标 ----------
  // 有 jump 类型节点的 targetScene 指向此场景
  const isJumpTarget = nodes.some((n) => {
    if (n.type !== 'jump') return false
    const targetScene = String(getNodeData(n).targetScene || '')
    return targetScene === scene.code
  })

  // ---------- 连接计数 ----------
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  let inCount = 0
  let outCount = 0
  edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source)
    const targetNode = nodeById.get(edge.target)
    if (!sourceNode || !targetNode) return
    const sourceSceneId = getNodeSceneGroupId(sourceNode)
    const targetSceneId = getNodeSceneGroupId(targetNode)
    if (sourceSceneId === targetSceneId) return
    if (sourceSceneId === scene.id) outCount++
    if (targetSceneId === scene.id) inCount++
  })

  // ---------- 结局场景 ----------
  // 该场景没有出边连接到其他场景
  const isEndingScene = outCount === 0

  // ---------- 选项场景处理 ----------
  const choiceNode = sceneNodes.find((n) => n.type === 'choice')
  if (!choiceNode) {
    return {
      shotCount,
      characterCount: characterIds.size,
      characterNames,
      isChoiceScene: false,
      isEndingScene,
      isJumpTarget,
      isConvergence,
      convergenceSourceCount,
      choiceOptions: [],
      previewText,
      connectionCount: { in: inCount, out: outCount },
    }
  }

  const choices = getChoices(choiceNode)
  const choiceOptions: ChoiceOptionInfo[] = choices.map((text, index) => {
    const edge = edges.find(
      (e) => e.source === choiceNode.id && e.sourceHandle === `choice-${index}`,
    )
    const targetNode = edge ? nodes.find((n) => n.id === edge.target) : undefined
    const targetSceneId = targetNode ? getNodeSceneGroupId(targetNode) : ''
    const targetScene = targetSceneId ? sceneById.get(targetSceneId) : undefined
    return {
      text: text || `选项 ${index + 1}`,
      targetCode: targetScene?.code || '未连接',
      targetSceneId,
    }
  })

  return {
    shotCount,
    characterCount: characterIds.size,
    characterNames,
    isChoiceScene: true,
    isEndingScene,
    isJumpTarget,
    isConvergence,
    convergenceSourceCount,
    choiceOptions,
    previewText,
    connectionCount: { in: inCount, out: outCount },
  }
}
