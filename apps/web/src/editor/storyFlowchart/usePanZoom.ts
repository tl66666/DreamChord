/**
 * usePanZoom.ts — 平移缩放 hook
 *
 * 从 StoryFlowchart.tsx 提取平移缩放逻辑为独立 hook。
 * 新增 jumpTo(worldX, worldY) 方法供小地图使用。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { PADDING, MIN_SCALE, MAX_SCALE } from './constants'

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

/**
 * 平移缩放 hook
 *
 * @param layoutWidth 布局总宽度（用于自适应）
 * @param layoutHeight 布局总高度（用于自适应）
 * @returns 容器引用、缩放/平移状态与操作方法
 */
export function usePanZoom(layoutWidth: number, layoutHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: PADDING, y: PADDING })
  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)
  const draggingRef = useRef<{
    startX: number
    startY: number
    offX: number
    offY: number
  } | null>(null)
  const didInitialFitRef = useRef(false)

  // ---------- 应用变换 ----------
  const applyTransform = useCallback(
    (nextScale: number, nextOffset: { x: number; y: number }) => {
      scaleRef.current = nextScale
      offsetRef.current = nextOffset
      setScale(nextScale)
      setOffset(nextOffset)
    },
    [],
  )

  // ---------- 自适应屏幕 ----------
  const fitToScreen = useCallback(() => {
    const el = containerRef.current
    if (!el || layoutWidth <= 0 || layoutHeight <= 0) return
    const rect = el.getBoundingClientRect()
    const scaleX = (rect.width - 60) / layoutWidth
    const scaleY = (rect.height - 60) / layoutHeight
    const nextScale = clampScale(Math.min(scaleX, scaleY, 1))
    const nx = Math.max(20, (rect.width - layoutWidth * nextScale) / 2)
    const ny = Math.max(20, (rect.height - layoutHeight * nextScale) / 2)
    applyTransform(nextScale, { x: nx, y: ny })
  }, [layoutWidth, layoutHeight, applyTransform])

  // ---------- 缩放（以容器中心为基准） ----------
  const zoomBy = useCallback(
    (factor: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const nextScale = clampScale(scaleRef.current * factor)
      const nx = cx - (cx - offsetRef.current.x) * (nextScale / scaleRef.current)
      const ny = cy - (cy - offsetRef.current.y) * (nextScale / scaleRef.current)
      applyTransform(nextScale, { x: nx, y: ny })
    },
    [applyTransform],
  )

  // ---------- 跳转到指定世界坐标（供小地图使用） ----------
  const jumpTo = useCallback(
    (worldX: number, worldY: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const nextScale = scaleRef.current
      const nx = rect.width / 2 - worldX * nextScale
      const ny = rect.height / 2 - worldY * nextScale
      applyTransform(nextScale, { x: nx, y: ny })
    },
    [applyTransform],
  )

  // ---------- 初始自适应 ----------
  useEffect(() => {
    if (didInitialFitRef.current) return
    if (layoutWidth <= PADDING * 2 || layoutHeight <= PADDING * 2) return
    didInitialFitRef.current = true
    requestAnimationFrame(() => fitToScreen())
  }, [layoutWidth, layoutHeight, fitToScreen])

  // ---------- 滚轮缩放（非 passive，阻止页面滚动） ----------
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const curScale = scaleRef.current
      const curOffset = offsetRef.current
      const delta = -e.deltaY * 0.0015
      const nextScale = clampScale(curScale * (1 + delta))
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const nx = mx - (mx - curOffset.x) * (nextScale / curScale)
      const ny = my - (my - curOffset.y) * (nextScale / curScale)
      applyTransform(nextScale, { x: nx, y: ny })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [applyTransform])

  // ---------- 拖拽平移（监听 window 以便拖出容器仍生效） ----------
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = draggingRef.current
      if (!drag) return
      const nx = drag.offX + (e.clientX - drag.startX)
      const ny = drag.offY + (e.clientY - drag.startY)
      applyTransform(scaleRef.current, { x: nx, y: ny })
    }
    const onUp = () => {
      draggingRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [applyTransform])

  // ---------- 鼠标按下：开始拖拽 ----------
  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.button !== 0) return
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offX: offsetRef.current.x,
      offY: offsetRef.current.y,
    }
  }, [])

  return {
    containerRef,
    scale,
    offset,
    scaleRef,
    offsetRef,
    draggingRef,
    fitToScreen,
    zoomBy,
    jumpTo,
    applyTransform,
    handleMouseDown,
  }
}
