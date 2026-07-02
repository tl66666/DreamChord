/**
 * layout.ts — 改进的布局算法
 *
 * 从 StoryFlowchart.tsx 提取 computeLayout 并改进：
 * - 使用 toChineseNumber 生成章节标题
 * - 分支车道分配：每个分支独占一个车道，按源场景 x 坐标水平偏移
 * - 章节带高度自适应
 */

import type {
  LayoutResult,
  CardPosition,
  ChapterBlock,
  BranchLane,
  SceneConnection,
} from './types'
import { toChineseNumber, compareSceneCode, type Scene } from '../sceneGraph'
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  CARD_GAP_X,
  CARD_GAP_Y,
  CHAPTER_HEADER_HEIGHT,
  CHAPTER_GAP_Y,
  PADDING,
} from './constants'

/**
 * 计算场景卡片的布局位置
 *
 * @param scenes 所有场景
 * @param connections 场景间连接
 * @param chapterTitles 章节自定义标题
 * @returns 布局结果（位置、章节块、分支车道、尺寸）
 */
export function computeLayout(
  scenes: Scene[],
  connections: SceneConnection[],
  chapterTitles: Map<string, string>,
  positionOverrides?: Map<string, { x: number; y: number }>,
): LayoutResult {
  const positions = new Map<string, CardPosition>()
  const chapterBlocks: ChapterBlock[] = []
  const branchLanes: BranchLane[] = []
  const overriddenSceneIds = new Set<string>()

  // 按章节分组
  const chapterMap = new Map<string, Scene[]>()
  scenes.forEach((s) => {
    if (!chapterMap.has(s.chapter)) chapterMap.set(s.chapter, [])
    chapterMap.get(s.chapter)!.push(s)
  })
  const sortedChapters = [...chapterMap.entries()].sort(([a], [b]) => Number(a) - Number(b))

  // 选项分支目标：被选项连接指向的场景
  const branchSources = new Map<string, string>() // branchSceneId -> sourceSceneId
  connections.forEach((c) => {
    if (c.isChoice && !branchSources.has(c.targetSceneId)) {
      branchSources.set(c.targetSceneId, c.sourceSceneId)
    }
  })

  let cursorY = PADDING

  sortedChapters.forEach(([chapterId, chapterScenes]) => {
    chapterScenes.sort((a, b) => compareSceneCode(a.code, b.code))
    const mainScenes = chapterScenes.filter((s) => !branchSources.has(s.id))
    const branchScenes = chapterScenes.filter((s) => branchSources.has(s.id))

    const headerY = cursorY
    cursorY += CHAPTER_HEADER_HEIGHT

    // ---------- 主线场景水平排列 ----------
    const mainY = cursorY
    mainScenes.forEach((scene, i) => {
      const override = positionOverrides?.get(scene.id)
      if (override) {
        positions.set(scene.id, {
          x: override.x, y: override.y,
          isBranch: false, laneIndex: -1, rank: i, isManual: true,
        })
        overriddenSceneIds.add(scene.id)
      } else {
        positions.set(scene.id, {
          x: PADDING + i * (CARD_WIDTH + CARD_GAP_X),
          y: mainY,
          isBranch: false,
          laneIndex: -1,
          rank: i,
        })
      }
    })
    cursorY += CARD_HEIGHT

    // ---------- 分支车道分配 ----------
    const branchesBySource = new Map<string, Scene[]>()
    branchScenes.forEach((s) => {
      const src = branchSources.get(s.id)!
      if (!branchesBySource.has(src)) branchesBySource.set(src, [])
      branchesBySource.get(src)!.push(s)
    })

    let maxLaneDepth = 0

    if (branchScenes.length > 0) {
      cursorY += CARD_GAP_Y
      const branchBaseY = cursorY

      let laneIndex = 0
      branchesBySource.forEach((branches, sourceId) => {
        const sourcePos = positions.get(sourceId)
        // 每个分支独占一个车道，按源场景 x 坐标水平偏移
        const laneX = sourcePos
          ? sourcePos.x
          : PADDING + laneIndex * (CARD_WIDTH + CARD_GAP_X)

        const laneHeight = branches.length * (CARD_HEIGHT + CARD_GAP_Y)

        // 注册分支车道
        branchLanes.push({
          index: laneIndex,
          sourceSceneId: sourceId,
          y: branchBaseY,
          height: laneHeight,
        })

        branches.forEach((scene, i) => {
          const override = positionOverrides?.get(scene.id)
          if (override) {
            positions.set(scene.id, {
              x: override.x, y: override.y,
              isBranch: true, laneIndex, rank: i, isManual: true,
            })
            overriddenSceneIds.add(scene.id)
          } else {
            positions.set(scene.id, {
              x: laneX,
              y: branchBaseY + i * (CARD_HEIGHT + CARD_GAP_Y),
              isBranch: true,
              laneIndex,
              rank: i,
            })
          }
          maxLaneDepth = Math.max(maxLaneDepth, i + 1)
        })

        laneIndex++
      })

      cursorY = branchBaseY + maxLaneDepth * (CARD_HEIGHT + CARD_GAP_Y)
    }

    // ---------- 章节块（自适应高度） ----------
    const bodyY = headerY + CHAPTER_HEADER_HEIGHT
    const bodyHeight = cursorY - bodyY

    chapterBlocks.push({
      id: chapterId,
      label: chapterTitles.get(chapterId) || `第${toChineseNumber(Number(chapterId))}章`,
      headerY,
      bodyY,
      bodyHeight,
    })

    cursorY += CHAPTER_GAP_Y
  })

  // ---------- 汇合场景居中对齐 ----------
  const convergenceByTarget = new Map<string, Set<string>>()
  connections.forEach((c) => {
    if (c.isConvergence) {
      if (!convergenceByTarget.has(c.targetSceneId)) {
        convergenceByTarget.set(c.targetSceneId, new Set())
      }
      convergenceByTarget.get(c.targetSceneId)!.add(c.sourceSceneId)
    }
  })

  convergenceByTarget.forEach((sourceIds, targetId) => {
    if (overriddenSceneIds.has(targetId)) return
    const targetPos = positions.get(targetId)
    if (!targetPos) return
    const sourcePositions = Array.from(sourceIds)
      .map((id) => positions.get(id))
      .filter((p): p is CardPosition => !!p)
    if (sourcePositions.length === 0) return
    const avgX = sourcePositions.reduce((sum, p) => sum + p.x, 0) / sourcePositions.length
    positions.set(targetId, { ...targetPos, x: avgX })
  })

  // ---------- 计算总尺寸 ----------
  let width = 0
  positions.forEach((p) => {
    width = Math.max(width, p.x + CARD_WIDTH)
  })

  return {
    positions,
    chapterBlocks,
    branchLanes,
    overriddenSceneIds,
    width: Math.max(width + PADDING, PADDING * 2),
    height: Math.max(cursorY, PADDING * 2),
  }
}
