/**
 * connections.ts — 连接计算 + 路径路由
 *
 * 从 StoryFlowchart.tsx 提取 computeConnections 和 computeConnectionPath，并增强：
 * - computeConnections 新增 isCrossChapter 字段
 * - 解析 jump 节点的 targetScene，添加跨章节 jump 连接
 * - computeConnectionPath 增加 isCrossChapter 参数，跨章节用 S 形曲线
 */

import type { Node, Edge } from '@xyflow/react'
import type { SceneConnection, ConnectionPath, CardPosition } from './types'
import {
  getNodeSceneGroupId,
  getNodeSceneCode,
  getNodeData,
  getChoices,
  toChineseNumber,
  type Scene,
} from '../sceneGraph'
import { CARD_WIDTH, CARD_HEIGHT } from './constants'

/**
 * 计算场景间的连接关系
 *
 * @param nodes 所有节点
 * @param edges 所有边
 * @param scenes 所有场景（用于判断跨章节和解析 jump 目标）
 * @returns 场景连接列表
 */
export function computeConnections(
  nodes: Node[],
  edges: Edge[],
  scenes: Scene[],
  convergenceMap?: Map<string, string[]>,
): SceneConnection[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const sceneById = new Map(scenes.map((s) => [s.id, s]))
  const sceneByCode = new Map(scenes.map((s) => [s.code, s]))
  const normalMap = new Map<string, SceneConnection>()
  const choiceMap = new Map<
    string,
    { source: string; target: string; labels: string[]; isCrossChapter: boolean; isConvergence: boolean }
  >()

  // ---------- 普通边和选项边 ----------
  edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source)
    const targetNode = nodeById.get(edge.target)
    if (!sourceNode || !targetNode) return

    const sourceSceneId = getNodeSceneGroupId(sourceNode)
    const targetSceneId = getNodeSceneGroupId(targetNode)
    if (!sourceSceneId || !targetSceneId || sourceSceneId === targetSceneId) return

    const isChoice = Boolean(edge.sourceHandle && edge.sourceHandle.startsWith('choice-'))
    const key = `${sourceSceneId}->${targetSceneId}`

    const sourceScene = sceneById.get(sourceSceneId)
    const targetScene = sceneById.get(targetSceneId)
    const isCrossChapter =
      !!sourceScene && !!targetScene && sourceScene.chapter !== targetScene.chapter

    if (isChoice) {
      const index = Number(String(edge.sourceHandle).replace('choice-', ''))
      const choices = getChoices(sourceNode)
      const label =
        choices[index] ||
        (typeof edge.label === 'string' ? edge.label : `选项 ${index + 1}`)
      if (!choiceMap.has(key)) {
        choiceMap.set(key, {
          source: sourceSceneId,
          target: targetSceneId,
          labels: [],
          isCrossChapter,
          isConvergence: convergenceMap?.has(targetSceneId) ?? false,
        })
      }
      choiceMap.get(key)!.labels.push(label)
    } else {
      if (!normalMap.has(key)) {
        normalMap.set(key, {
          id: edge.id,
          sourceSceneId,
          targetSceneId,
          isChoice: false,
          isCrossChapter,
          isConvergence: convergenceMap?.has(targetSceneId) ?? false,
          label: '',
        })
      }
    }
  })

  // ---------- jump 节点：跨章节跳转连接 ----------
  nodes.forEach((node) => {
    if (node.type !== 'jump') return

    let sourceSceneId = getNodeSceneGroupId(node)
    const sourceSceneCode = getNodeSceneCode(node)
    const targetSceneCode = String(getNodeData(node).targetScene || '')
    if (!targetSceneCode) return

    // 如果没有 sceneGroupId，尝试通过 sceneCode 查找源场景
    if (!sourceSceneId && sourceSceneCode) {
      const sourceScene = sceneByCode.get(sourceSceneCode)
      if (sourceScene) sourceSceneId = sourceScene.id
    }
    if (!sourceSceneId) return

    const targetScene = sceneByCode.get(targetSceneCode)
    if (!targetScene) return
    if (sourceSceneId === targetScene.id) return

    const sourceScene = sceneById.get(sourceSceneId) || sceneByCode.get(sourceSceneCode)
    const isCrossChapter = !!sourceScene && sourceScene.chapter !== targetScene.chapter

    const key = `jump-${sourceSceneId}->${targetScene.id}`
    if (normalMap.has(key)) return

    const label = isCrossChapter
      ? `跳转 · 第${toChineseNumber(Number(targetScene.chapter))}章`
      : '跳转'

    normalMap.set(key, {
      id: `jump-conn-${node.id}`,
      sourceSceneId,
      targetSceneId: targetScene.id,
      isChoice: false,
      isCrossChapter,
      isConvergence: convergenceMap?.has(targetScene.id) ?? false,
      label,
    })
  })

  // ---------- 合并结果 ----------
  const choiceConnections: SceneConnection[] = Array.from(choiceMap.values()).map((c, i) => ({
    id: `choice-conn-${i}`,
    sourceSceneId: c.source,
    targetSceneId: c.target,
    isChoice: true,
    isCrossChapter: c.isCrossChapter,
    isConvergence: c.isConvergence,
    label: c.labels.join(' / '),
  }))

  return [...normalMap.values(), ...choiceConnections]
}

/**
 * 计算连接线的 SVG 路径
 *
 * @param from 源卡片位置
 * @param to 目标卡片位置
 * @param isCrossChapter 是否跨章节连接（使用 S 形曲线）
 * @returns SVG 路径字符串和标签位置
 */
export function computeConnectionPath(
  from: CardPosition,
  to: CardPosition,
  isCrossChapter: boolean = false,
  isConvergence: boolean = false,
): ConnectionPath {
  const dy = to.y - from.y

  // 汇合连接：弧线向汇合点顶部中心汇聚
  if (isConvergence) {
    const sx = from.x + CARD_WIDTH / 2
    const sy = from.y + CARD_HEIGHT
    const ex = to.x + CARD_WIDTH / 2
    const ey = to.y
    const cp1x = sx + (ex - sx) * 0.2
    const cp2x = ex - (ex - sx) * 0.2
    return {
      path: `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ey}, ${ex} ${ey}`,
      labelX: (sx + ex) / 2,
      labelY: (sy + ey) / 2,
    }
  }

  // 跨章节：S 形曲线
  if (isCrossChapter) {
    const sx = from.x + CARD_WIDTH / 2
    const sy = from.y + CARD_HEIGHT
    const ex = to.x + CARD_WIDTH / 2
    const ey = to.y
    const cp1y = sy + dy * 0.4
    const cp2y = ey - dy * 0.4
    return {
      path: `M ${sx} ${sy} C ${sx} ${cp1y}, ${ex} ${cp2y}, ${ex} ${ey}`,
      labelX: (sx + ex) / 2,
      labelY: sy + dy * 0.5,
    }
  }

  const vertical = dy > CARD_HEIGHT * 0.4

  if (vertical) {
    // 由下到上：分支场景在下方
    const sx = from.x + CARD_WIDTH / 2
    const sy = from.y + CARD_HEIGHT
    const ex = to.x + CARD_WIDTH / 2
    const ey = to.y
    const midY = (sy + ey) / 2
    return {
      path: `M ${sx} ${sy} C ${sx} ${midY}, ${ex} ${midY}, ${ex} ${ey}`,
      labelX: (sx + ex) / 2,
      labelY: midY,
    }
  }

  // 由右到左：同章节水平连接
  const sx = from.x + CARD_WIDTH
  const sy = from.y + CARD_HEIGHT / 2
  const ex = to.x
  const ey = to.y + CARD_HEIGHT / 2
  const midX = (sx + ex) / 2
  return {
    path: `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ey}, ${ex} ${ey}`,
    labelX: midX,
    labelY: (sy + ey) / 2,
  }
}
