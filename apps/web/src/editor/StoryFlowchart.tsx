import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { useConfirm } from '../components/FeedbackProvider'
import { ZoomIn, ZoomOut, Maximize2, Layers } from 'lucide-react'
import type { Node, Edge } from '@xyflow/react'

import type { Scene } from './sceneGraph'
import { toChineseNumber, findConvergenceScenes, normalizeChapterTitle } from './sceneGraph'
import { loadLibraryScenes } from '../lib/libraryData'

import type { SceneInfo, SceneFilter, ContextMenuState, LayoutResult, CardPosition, SceneConnection, ConnectionPath } from './storyFlowchart/types'
import { CARD_WIDTH, CARD_HEIGHT } from './storyFlowchart/constants'
import { resolveBgUrl } from './storyFlowchart/bgUrl'
import { computeSceneInfo } from './storyFlowchart/sceneInfo'
import { computeConnections, computeConnectionPath } from './storyFlowchart/connections'
import { computeLayout } from './storyFlowchart/layout'
import { usePanZoom } from './storyFlowchart/usePanZoom'
import { useKeyboardNav } from './storyFlowchart/useKeyboardNav'

import SceneCard from './storyFlowchart/SceneCard'
import ChapterBand from './storyFlowchart/ChapterBand'
import SearchBar from './storyFlowchart/SearchBar'
import ContextMenu from './storyFlowchart/ContextMenu'
import Minimap from './storyFlowchart/Minimap'

interface StoryFlowchartProps {
  nodes: Node[]
  edges: Edge[]
  scenes: Scene[]
  selectedSceneId: string | null
  onSelectScene: (sceneId: string) => void
  onEditScene?: (sceneId: string) => void
  onAddScene?: (chapter: string) => void
  onDeleteScene?: (sceneId: string) => void
  onRenameScene?: (sceneId: string, title: string) => void
  onAddChapter?: () => void
  chapters?: Array<{ id: string; title: string; order: number }>
  positionOverrides?: Map<string, { x: number; y: number }>
  onRepositionScene?: (sceneId: string, x: number, y: number) => void
  onCreateConnection?: (sourceSceneId: string, targetSceneId: string) => void
  onDisconnectConnection?: (sourceSceneId: string, targetSceneId: string) => void
}

export default function StoryFlowchart({
  nodes, edges, scenes,
  selectedSceneId, onSelectScene,
  onEditScene, onAddScene, onDeleteScene, onRenameScene, onAddChapter, chapters,
  positionOverrides, onRepositionScene,
  onCreateConnection, onDisconnectConnection,
}: StoryFlowchartProps) {
  const confirm = useConfirm()
  const libraryScenes = useMemo(() => loadLibraryScenes(), [])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<SceneFilter>({ chapter: 'all', sceneType: 'all', hasCharacters: false })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, targetSceneId: null })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const sizeObserverRef = useRef<HTMLDivElement>(null)

  // ---------- 图计算 ----------
  const sceneById = useMemo(() => new Map(scenes.map(s => [s.id, s])), [scenes])

  const convergenceMap = useMemo(
    () => findConvergenceScenes(nodes, edges, scenes),
    [nodes, edges, scenes],
  )

  const connections = useMemo(
    () => computeConnections(nodes, edges, scenes, convergenceMap),
    [nodes, edges, scenes, convergenceMap],
  )

  const sceneInfoMap = useMemo(() => {
    const m = new Map<string, SceneInfo>()
    scenes.forEach(s => m.set(s.id, computeSceneInfo(s, nodes, edges, sceneById, convergenceMap)))
    return m
  }, [scenes, nodes, edges, sceneById, convergenceMap])

  const chapterTitles = useMemo(() => {
    const m = new Map<string, string>()
    if (chapters && chapters.length > 0) {
      chapters.forEach(ch => {
        const chapterNum = (ch.order ?? 0) + 1
        const title = ch.title || `第${toChineseNumber(chapterNum)}章`
        m.set(String(chapterNum), normalizeChapterTitle(title, ch.order ?? 0))
      })
    }
    return m
  }, [chapters])

  const layout: LayoutResult = useMemo(
    () => computeLayout(scenes, connections, chapterTitles, positionOverrides),
    [scenes, connections, chapterTitles, positionOverrides],
  )

  // ---------- 搜索/过滤高亮 ----------
  const { highlightedIds, dimmedIds } = useMemo(() => {
    const highlighted = new Set<string>()
    const dimmed = new Set<string>()
    const hasQuery = searchQuery.trim().length > 0
    const hasFilter = activeFilter.chapter !== 'all' || activeFilter.sceneType !== 'all'

    if (!hasQuery && !hasFilter) return { highlightedIds: highlighted, dimmedIds: dimmed }

    const q = searchQuery.trim().toLowerCase()
    scenes.forEach(s => {
      const info = sceneInfoMap.get(s.id)
      let match = true
      if (hasQuery) {
        match = s.code.toLowerCase().includes(q) ||
                s.title.toLowerCase().includes(q) ||
                (s.preview || '').toLowerCase().includes(q)
      }
      if (match && activeFilter.chapter !== 'all') {
        match = s.chapter === activeFilter.chapter
      }
      if (match && activeFilter.sceneType !== 'all') {
        switch (activeFilter.sceneType) {
          case 'choice': match = !!info?.isChoiceScene; break
          case 'ending': match = !!info?.isEndingScene; break
          case 'branch':
            match = connections.some(c => c.isChoice && c.targetSceneId === s.id)
            break
          case 'normal':
            match = !info?.isChoiceScene && !connections.some(c => c.isChoice && c.targetSceneId === s.id)
            break
        }
      }
      if (match) highlighted.add(s.id)
      else dimmed.add(s.id)
    })
    return { highlightedIds: highlighted, dimmedIds: dimmed }
  }, [scenes, sceneInfoMap, connections, searchQuery, activeFilter])

  // ---------- 平移缩放 ----------
  const {
    containerRef, scale, offset, draggingRef, scaleRef, offsetRef,
    fitToScreen, zoomBy, jumpTo, handleMouseDown,
  } = usePanZoom(layout.width, layout.height)

  // ---------- 连接拖拽状态 ----------
  const [connecting, setConnecting] = useState<{
    sourceSceneId: string
    mouseX: number
    mouseY: number
  } | null>(null)

  const handleStartConnection = useCallback((sceneId: string, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const worldX = (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current
    const worldY = (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current
    setConnecting({ sourceSceneId: sceneId, mouseX: worldX, mouseY: worldY })
  }, [containerRef, offsetRef, scaleRef])

  const handleCompleteConnection = useCallback((targetSceneId: string) => {
    setConnecting(prev => {
      if (prev && prev.sourceSceneId !== targetSceneId && onCreateConnection) {
        onCreateConnection(prev.sourceSceneId, targetSceneId)
      }
      return null
    })
  }, [onCreateConnection])

  // 连接拖拽中跟踪鼠标
  useEffect(() => {
    if (!connecting) return
    const handleMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const worldX = (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current
      const worldY = (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current
      setConnecting(prev => prev ? { ...prev, mouseX: worldX, mouseY: worldY } : null)
    }
    const handleUp = () => {
      setConnecting(null)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [connecting, containerRef, offsetRef, scaleRef])

  // 连接线右键断开
  const [disconnectMenu, setDisconnectMenu] = useState<{ visible: boolean; x: number; y: number; conn: SceneConnection | null }>({
    visible: false, x: 0, y: 0, conn: null,
  })

  // ---------- 容器尺寸观察 ----------
  useEffect(() => {
    const el = sizeObserverRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---------- 键盘导航 ----------
  useKeyboardNav({
    scenes,
    positions: layout.positions,
    selectedSceneId,
    onSelectScene,
    onEditScene: onEditScene || (() => {}),
    onDeleteScene: onDeleteScene || (() => {}),
    onRenameScene: (id) => setRenamingId(id),
    onZoomIn: () => zoomBy(1.2),
    onZoomOut: () => zoomBy(1 / 1.2),
    onFitToScreen: fitToScreen,
    onFocusSearch: () => searchInputRef.current?.focus(),
    containerRef,
  })

  // ---------- 右键菜单 ----------
  const handleContextMenu = useCallback((e: React.MouseEvent, sceneId: string | null) => {
    e.preventDefault()
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetSceneId: sceneId })
  }, [])

  const handleJumpToScene = useCallback((sceneId: string) => {
    onSelectScene(sceneId)
    const pos = layout.positions.get(sceneId)
    if (pos) {
      jumpTo(pos.x + CARD_WIDTH / 2, pos.y + CARD_HEIGHT / 2)
    }
  }, [onSelectScene, layout.positions, jumpTo])

  // ---------- 重命名场景 ----------
  const handleRenameScene = useCallback((sceneId: string) => {
    setRenamingId(sceneId)
  }, [])

  // ---------- 连接线渲染 ----------
  const connectionPaths = useMemo(() => {
    const result: Array<{ conn: SceneConnection; pathData: ConnectionPath }> = []
    connections.forEach(conn => {
      const from = layout.positions.get(conn.sourceSceneId)
      const to = layout.positions.get(conn.targetSceneId)
      if (!from || !to) return
      const pathData = computeConnectionPath(from, to, conn.isCrossChapter, conn.isConvergence)
      result.push({ conn, pathData })
    })
    return result
  }, [connections, layout.positions])

  // ---------- 章节标签映射 ----------
  const chapterLabelMap = useMemo(() => {
    const m = new Map<string, string>()
    layout.chapterBlocks.forEach(b => m.set(b.id, b.label))
    return m
  }, [layout.chapterBlocks])

  // ---------- 空状态 ----------
  if (scenes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-dream-50/40">
        <div className="text-center">
          <Layers className="mx-auto mb-3 h-12 w-12 text-dream-200" />
          <p className="text-sm text-dream-400">还没有场景</p>
          <p className="mt-1 text-xs text-dream-300">切换到「场景编辑」创建第一个场景</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={sizeObserverRef} className="relative h-full w-full overflow-hidden bg-dream-50/40" tabIndex={0}>
      {/* 搜索过滤栏 */}
      <SearchBar
        ref={searchInputRef}
        scenes={scenes}
        chapters={chapters}
        onSearch={setSearchQuery}
        onFilter={setActiveFilter}
        onJumpToScene={handleJumpToScene}
      />

      {/* 画布 */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab"
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => handleContextMenu(e, null)}
        style={{ cursor: draggingRef.current ? 'grabbing' : 'grab' }}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: layout.width,
            height: layout.height,
            position: 'relative',
          }}
        >
          {/* 章节带背景 */}
          <ChapterBand blocks={layout.chapterBlocks} width={layout.width} />

          {/* SVG 连接线 */}
          <svg
            className="pointer-events-none absolute left-0 top-0"
            width={layout.width}
            height={layout.height}
            style={{ overflow: 'visible' }}
          >
            <defs>
              <marker id="sf-arrow-solid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
              <marker id="sf-arrow-dashed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ec4899" />
              </marker>
              <marker id="sf-arrow-cross" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" />
              </marker>
              <marker id="sf-arrow-convergence" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
              </marker>
            </defs>
            {connectionPaths.map(({ conn, pathData }) => {
              if (!pathData) return null
              const isDimmedConn = dimmedIds.has(conn.sourceSceneId) && dimmedIds.has(conn.targetSceneId)
              const stroke = conn.isConvergence ? '#a855f7' : conn.isCrossChapter ? '#f97316' : conn.isChoice ? '#ec4899' : '#94a3b8'
              const dashArray = conn.isConvergence ? undefined : conn.isCrossChapter ? '2 3 6 3' : conn.isChoice ? '5 4' : undefined
              return (
                <g key={conn.id} opacity={isDimmedConn ? 0.1 : 1}>
                  <path
                    d={pathData.path}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={conn.isConvergence ? 2.5 : conn.isCrossChapter ? 2 : 1.5}
                    strokeDasharray={dashArray}
                    markerEnd={`url(#${conn.isConvergence ? 'sf-arrow-convergence' : conn.isCrossChapter ? 'sf-arrow-cross' : conn.isChoice ? 'sf-arrow-dashed' : 'sf-arrow-solid'})`}
                    style={{ cursor: onDisconnectConnection ? 'context-menu' : 'default' }}
                    onContextMenu={onDisconnectConnection ? (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDisconnectMenu({ visible: true, x: e.clientX, y: e.clientY, conn })
                    } : undefined}
                  />
                  {conn.label && (
                    <text
                      x={pathData.labelX}
                      y={pathData.labelY - 4}
                      textAnchor="middle"
                      fontSize="11"
                      fill={stroke}
                      className="select-none"
                      style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 }}
                    >
                      {conn.label}
                    </text>
                  )}
                </g>
              )
            })}
            {/* 拖拽中的临时连接线 */}
            {connecting && (() => {
              const sourcePos = layout.positions.get(connecting.sourceSceneId)
              if (!sourcePos) return null
              const sx = sourcePos.x + CARD_WIDTH
              const sy = sourcePos.y + CARD_HEIGHT / 2
              const ex = connecting.mouseX
              const ey = connecting.mouseY
              const midX = (sx + ex) / 2
              return (
                <path
                  d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ey}, ${ex} ${ey}`}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                />
              )
            })()}
          </svg>

          {/* 场景卡片 */}
          {scenes.map(scene => {
            const pos = layout.positions.get(scene.id)
            const info = sceneInfoMap.get(scene.id)
            if (!pos || !info) return null
            return (
              <SceneCard
                key={scene.id}
                scene={scene}
                pos={pos}
                info={info}
                bgUrl={resolveBgUrl(scene.backgroundId, libraryScenes)}
                chapterLabel={chapterLabelMap.get(scene.chapter) || ''}
                isSelected={selectedSceneId === scene.id}
                isHighlighted={highlightedIds.has(scene.id)}
                isDimmed={dimmedIds.has(scene.id)}
                isConnectionTarget={!!connecting && connecting.sourceSceneId !== scene.id}
                onSelect={onSelectScene}
                onContextMenu={(e, id) => handleContextMenu(e, id)}
                onRenameScene={onRenameScene ? (id) => setRenamingId(id) : undefined}
                onReposition={onRepositionScene}
                onStartConnection={onCreateConnection ? handleStartConnection : undefined}
                onCompleteConnection={connecting ? handleCompleteConnection : undefined}
              />
            )
          })}

          {/* 内联重命名覆盖层 */}
          {renamingId && onRenameScene && (() => {
            const scene = scenes.find(s => s.id === renamingId)
            const pos = layout.positions.get(renamingId)
            if (!scene || !pos) return null
            return (
              <InlineRename
                scene={scene}
                pos={pos}
                onConfirm={(title) => { onRenameScene(renamingId, title); setRenamingId(null) }}
                onCancel={() => setRenamingId(null)}
              />
            )
          })()}
        </div>
      </div>

      {/* 图例 */}
      <div className="absolute right-4 top-4 flex flex-col gap-1.5 rounded-lg border border-dream-200 bg-white/90 px-3 py-2 text-[10px] text-dream-500 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-4 rounded-sm bg-slate-400" />
          <span>普通连接</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 border-t-2 border-dashed border-pink-400" />
          <span>选项分支</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 border-t-2 border-dotted border-orange-400" />
          <span>跨章节跳转</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-4 rounded-sm bg-purple-500" />
          <span>汇合连接</span>
        </div>
      </div>

      {/* 缩放控制 */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white px-2 py-1.5 shadow-md">
        <button onClick={() => zoomBy(1 / 1.2)} className="rounded p-1 text-dream-500 hover:bg-dream-50" title="缩小">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-[3rem] text-center text-xs font-medium text-dream-600">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomBy(1.2)} className="rounded p-1 text-dream-500 hover:bg-dream-50" title="放大">
          <ZoomIn className="h-4 w-4" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-dream-200" />
        <button onClick={fitToScreen} className="rounded p-1 text-dream-500 hover:bg-dream-50" title="自适应">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* 小地图 */}
      <Minimap
        layout={layout}
        scale={scale}
        offset={offset}
        containerSize={containerSize}
        selectedSceneId={selectedSceneId}
        onJumpTo={jumpTo}
      />

      {/* 右键菜单 */}
      <ContextMenu
        state={contextMenu}
        scene={contextMenu.targetSceneId ? scenes.find(s => s.id === contextMenu.targetSceneId) || null : null}
        onClose={() => setContextMenu(s => ({ ...s, visible: false }))}
        onEditScene={onEditScene || (() => {})}
        onRenameScene={handleRenameScene}
        onDeleteScene={async (id) => { if (await confirm({ message: '确定删除此场景吗？', danger: true })) onDeleteScene?.(id) }}
        onAddSceneAfter={(id) => {
          const scene = scenes.find(s => s.id === id)
          onAddScene?.(scene?.chapter || '1')
        }}
        onAddScene={onAddScene || (() => {})}
        onAddChapter={onAddChapter || (() => {})}
        onFitToScreen={fitToScreen}
      />

      {/* 连接断开菜单 */}
      {disconnectMenu.visible && disconnectMenu.conn && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setDisconnectMenu(s => ({ ...s, visible: false }))} />
          <div
            className="fixed z-50 rounded-lg border border-dream-100 bg-white py-1 shadow-lg"
            style={{ left: disconnectMenu.x, top: disconnectMenu.y }}
          >
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={() => {
                if (disconnectMenu.conn && onDisconnectConnection) {
                  onDisconnectConnection(disconnectMenu.conn.sourceSceneId, disconnectMenu.conn.targetSceneId)
                }
                setDisconnectMenu(s => ({ ...s, visible: false }))
              }}
            >
              断开此连接
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------- 内联重命名组件 ----------
function InlineRename({
  scene, pos, onConfirm, onCancel,
}: {
  scene: Scene
  pos: CardPosition
  onConfirm: (title: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(scene.title)
  return (
    <div
      className="absolute z-30"
      style={{ left: pos.x, top: pos.y, width: CARD_WIDTH }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 rounded-lg border-2 border-dream-400 bg-white p-2 shadow-xl">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm(title)
            if (e.key === 'Escape') onCancel()
          }}
          autoFocus
          className="flex-1 rounded border border-dream-200 px-2 py-1 text-sm"
          placeholder="场景标题"
        />
        <button onClick={() => onConfirm(title)} className="rounded p-1 text-green-600 hover:bg-green-50">
          ✓
        </button>
        <button onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100">
          ✕
        </button>
      </div>
    </div>
  )
}
