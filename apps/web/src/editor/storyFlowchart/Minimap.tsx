import { useCallback } from 'react'
import type { LayoutResult } from './types'
import { MINIMAP_WIDTH, MINIMAP_HEIGHT, CARD_WIDTH, CARD_HEIGHT } from './constants'

interface MinimapProps {
  layout: LayoutResult
  scale: number
  offset: { x: number; y: number }
  containerSize: { width: number; height: number }
  selectedSceneId: string | null
  onJumpTo: (worldX: number, worldY: number) => void
}

export default function Minimap({ layout, scale, offset, containerSize, selectedSceneId, onJumpTo }: MinimapProps) {
  const miniScale = Math.min(
    MINIMAP_WIDTH / Math.max(layout.width, 1),
    MINIMAP_HEIGHT / Math.max(layout.height, 1),
    1,
  )

  // 视口在世界坐标系中的范围
  const viewW = containerSize.width / scale
  const viewH = containerSize.height / scale
  const viewX = -offset.x / scale
  const viewY = -offset.y / scale

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = (e.clientX - rect.left) / miniScale
    const my = (e.clientY - rect.top) / miniScale
    onJumpTo(mx, my)
  }, [miniScale, onJumpTo])

  return (
    <div className="absolute bottom-4 left-4 rounded-lg border border-dream-200 bg-white/90 p-1 shadow-md backdrop-blur-sm">
      <svg
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        onClick={handleClick}
        className="cursor-pointer rounded"
        style={{ background: '#faf5ff' }}
      >
        {/* 场景缩略矩形 */}
        {Array.from(layout.positions.entries()).map(([id, pos]) => {
          const isSelected = id === selectedSceneId
          let fill = '#c4b5fd' // 默认紫色
          if (isSelected) fill = '#8b5cf6'
          else if (pos.isBranch) fill = '#fcd34d' // 分支黄色
          return (
            <rect
              key={id}
              x={pos.x * miniScale}
              y={pos.y * miniScale}
              width={Math.max(CARD_WIDTH * miniScale, 2)}
              height={Math.max(CARD_HEIGHT * miniScale, 2)}
              fill={fill}
              rx={1}
              opacity={isSelected ? 1 : 0.7}
            />
          )
        })}
        {/* 视口矩形 */}
        <rect
          x={viewX * miniScale}
          y={viewY * miniScale}
          width={viewW * miniScale}
          height={viewH * miniScale}
          fill="none"
          stroke="#7c3aed"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          rx={2}
        />
      </svg>
      <div className="mt-0.5 text-center text-[9px] text-dream-400">小地图</div>
    </div>
  )
}
