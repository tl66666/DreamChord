import React, { useState, useRef, useEffect, memo } from 'react'
import { Film, Users, Clapperboard, GitBranch, ArrowLeftRight, Pencil, Check, X, Pin, GitMerge } from 'lucide-react'
import type { Scene } from '../sceneGraph'
import type { CardPosition, SceneInfo } from './types'
import { CARD_WIDTH, CARD_HEIGHT } from './constants'

interface SceneCardProps {
  scene: Scene
  pos: CardPosition
  info: SceneInfo
  bgUrl: string
  chapterLabel: string
  isSelected: boolean
  isHighlighted: boolean
  isDimmed: boolean
  isConnectionTarget?: boolean
  onSelect: (sceneId: string) => void
  onContextMenu: (e: React.MouseEvent, sceneId: string) => void
  onRenameScene?: (sceneId: string, title: string) => void
  onReposition?: (sceneId: string, x: number, y: number) => void
  onStartConnection?: (sceneId: string, e: React.MouseEvent) => void
  onCompleteConnection?: (sceneId: string) => void
}

/** 截断文本，超出最大长度时以省略号结尾 */
function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

const SceneCard = memo(function SceneCard({
  scene,
  pos,
  info,
  bgUrl,
  chapterLabel,
  isSelected,
  isHighlighted,
  isDimmed,
  onSelect,
  onContextMenu,
  onRenameScene,
  onReposition,
  onStartConnection,
  onCompleteConnection,
  isConnectionTarget,
}: SceneCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(scene.title)

  // 拖拽状态机
  const dragStateRef = useRef<{ startX: number; startY: number; dx: number; dy: number } | null>(null)
  const didDragRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 })

  // 边框颜色：选中 > 汇合场景 > 选项场景 > 分支场景 > 普通
  const borderColor = isSelected
    ? 'border-dream-500'
    : info.isConvergence
      ? 'border-purple-300'
      : info.isChoiceScene
        ? 'border-pink-300'
        : pos.isBranch
          ? 'border-amber-200'
          : 'border-dream-200'

  const handleStartEdit = () => {
    if (!onRenameScene) return
    setEditValue(scene.title)
    setIsEditing(true)
  }

  const handleConfirmEdit = () => {
    const trimmed = editValue.trim()
    if (onRenameScene && trimmed) {
      onRenameScene(scene.id, trimmed)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditValue(scene.title)
  }

  // 拖拽处理
  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e: MouseEvent) => {
      if (!dragStateRef.current) return
      const dx = e.clientX - dragStateRef.current.startX
      const dy = e.clientY - dragStateRef.current.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        didDragRef.current = true
      }
      dragStateRef.current.dx = dx
      dragStateRef.current.dy = dy
      setDragOffset({ dx, dy })
    }
    const handleUp = () => {
      if (didDragRef.current && dragStateRef.current && onReposition) {
        onReposition(scene.id, pos.x + dragStateRef.current.dx, pos.y + dragStateRef.current.dy)
      }
      dragStateRef.current = null
      setIsDragging(false)
      setDragOffset({ dx: 0, dy: 0 })
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDragging, onReposition, scene.id, pos.x, pos.y])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // 仅左键
    if (isEditing) return
    e.stopPropagation() // 阻止画布平移
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 }
    didDragRef.current = false
    setIsDragging(true)
  }

  const handleClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    onSelect(scene.id)
  }

  const displayX = pos.x + dragOffset.dx
  const displayY = pos.y + dragOffset.dy

  return (
    <div
      className={`group absolute overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md ${borderColor} ${isSelected ? 'ring-2 ring-dream-500' : ''} ${isHighlighted && !isSelected ? 'ring-2 ring-dream-400' : ''} ${isDimmed ? 'opacity-20 grayscale' : ''} ${isDragging ? 'cursor-grabbing shadow-lg z-50' : onReposition ? 'cursor-grab' : 'cursor-pointer'}`}
      style={{ left: displayX, top: displayY, width: CARD_WIDTH, height: CARD_HEIGHT }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, scene.id)}
    >
      {/* 手动定位标记 */}
      {pos.isManual && (
        <span className="absolute right-1 top-5 z-10 text-dream-400" title="手动定位">
          <Pin className="h-2.5 w-2.5" />
        </span>
      )}

      {/* 连接锚点：右侧出口 */}
      {onStartConnection && (
        <div
          className={`absolute right-0 top-1/2 z-20 h-3 w-3 -translate-y-1/2 translate-x-1/2 cursor-crosshair rounded-full border-2 border-white shadow transition ${
            isConnectionTarget ? 'bg-purple-500 scale-150' : 'bg-dream-400 hover:bg-dream-600 hover:scale-125'
          }`}
          title="拖拽创建连接"
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onStartConnection(scene.id, e)
          }}
        />
      )}

      {/* 连接锚点：左侧入口 */}
      {onCompleteConnection && (
        <div
          className={`absolute left-0 top-1/2 z-20 h-3 w-3 -translate-y-1/2 -translate-x-1/2 cursor-pointer rounded-full border-2 border-white shadow transition ${
            isConnectionTarget ? 'bg-purple-500 scale-150 ring-2 ring-purple-300' : 'bg-dream-300 opacity-0 group-hover:opacity-100 hover:bg-dream-500 hover:scale-125'
          }`}
          title="放开以连接到此场景"
          onMouseUp={(e) => {
            e.stopPropagation()
            onCompleteConnection(scene.id)
          }}
        />
      )}
      {/* ============ 顶部背景缩略图区 (h-12 = 48px) ============ */}
      <div className="relative h-12 overflow-hidden bg-dream-50">
        {bgUrl ? (
          <img src={bgUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-dream-300">
            <Film className="h-5 w-5" />
          </div>
        )}

        {/* 左上角：代码徽章 */}
        <span className="absolute left-1 top-1 rounded bg-black/50 px-1 py-0.5 font-mono text-[9px] font-medium text-white">
          {scene.code}
        </span>

        {/* 右上角：类型徽章组 */}
        <div className="absolute right-1 top-1 flex gap-0.5">
          {info.isConvergence && (
            <span
              className="flex items-center gap-0.5 rounded bg-purple-500/85 px-1 py-0.5 text-[9px] font-semibold text-white"
              title={`汇合点：来自 ${info.convergenceSourceCount} 个源场景`}
            >
              <GitMerge className="h-2 w-2" />
              汇合{info.convergenceSourceCount}
            </span>
          )}
          {info.isChoiceScene && (
            <span className="rounded bg-pink-500/85 px-1 py-0.5 text-[9px] font-semibold text-white">
              {info.choiceOptions.length}分支
            </span>
          )}
          {info.isEndingScene && (
            <span className="rounded bg-green-500/85 px-1 py-0.5 text-[9px] font-semibold text-white">
              END
            </span>
          )}
          {info.isJumpTarget && (
            <span className="rounded bg-orange-500/85 px-1 py-0.5 text-[9px] font-semibold text-white">
              JUMP
            </span>
          )}
        </div>

        {/* 左下角：章节标签 */}
        <span className="absolute bottom-0.5 left-1 rounded bg-black/40 px-1 text-[8px] text-white/90">
          {chapterLabel}
        </span>
      </div>

      {/* ============ 内容区 ============ */}
      <div className="flex flex-col overflow-hidden px-2 py-1.5" style={{ height: CARD_HEIGHT - 48 }}>
        {/* 标题（2行截断）或内联编辑模式 */}
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmEdit()
                if (e.key === 'Escape') handleCancelEdit()
              }}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-dream-300 px-1 py-0.5 text-xs text-dream-700 focus:border-dream-400 focus:outline-none"
              autoFocus
            />
            <button
              onClick={(e) => { e.stopPropagation(); handleConfirmEdit() }}
              className="shrink-0 text-green-500 hover:text-green-600"
              title="确认重命名"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleCancelEdit() }}
              className="shrink-0 text-red-400 hover:text-red-500"
              title="取消"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            className="flex items-start gap-0.5"
            onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit() }}
          >
            <h3 className="line-clamp-2 flex-1 text-xs font-medium leading-tight text-dream-700">
              {scene.title}
            </h3>
            {onRenameScene && (
              <Pencil className="mt-0.5 h-2.5 w-2.5 shrink-0 text-dream-300 opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </div>
        )}

        {/* 预览文本（1行截断） */}
        <p className="mt-0.5 truncate text-[10px] leading-tight text-dream-400">
          {truncate(info.previewText || scene.preview, 32)}
        </p>

        {/* 统计行：镜头数、角色数、选项数、连接数 */}
        <div className="mt-1 flex items-center gap-2 text-[9px] text-dream-400">
          <span className="flex items-center gap-0.5" title="镜头数">
            <Clapperboard className="h-2.5 w-2.5" />
            {info.shotCount}
          </span>
          <span className="flex items-center gap-0.5" title="角色数">
            <Users className="h-2.5 w-2.5" />
            {info.characterCount}
          </span>
          {info.isChoiceScene && (
            <span className="flex items-center gap-0.5" title="选项数">
              <GitBranch className="h-2.5 w-2.5" />
              {info.choiceOptions.length}
            </span>
          )}
          <span className="flex items-center gap-0.5" title={`连接数（入 ${info.connectionCount.in} / 出 ${info.connectionCount.out}）`}>
            <ArrowLeftRight className="h-2.5 w-2.5" />
            {info.connectionCount.in + info.connectionCount.out}
          </span>
        </div>

        {/* 选项去向列表（仅选项场景，最多3个） */}
        {info.isChoiceScene && info.choiceOptions.length > 0 && (
          <div className="mt-auto space-y-0.5 overflow-hidden pt-1">
            {info.choiceOptions.slice(0, 3).map((opt) => (
              <div key={opt.text} className="flex items-center gap-1 text-[9px]">
                <span className="truncate flex-1 text-dream-500" title={opt.text}>
                  {truncate(opt.text, 10)}
                </span>
                <span className="shrink-0 rounded bg-pink-50 px-1 font-mono text-pink-400">
                  {opt.targetCode}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

export default SceneCard
