/**
 * SceneTree.tsx — 左栏：章节/场景树
 *
 * 从现有节点图自动构建章节→场景的树状结构，
 * 支持新建章节、新建场景、选中场景、删除场景、
 * 双击内联重命名场景/章节。
 */

import { useMemo, useState } from 'react'
import { useConfirm } from '../components/FeedbackProvider'
import { BookOpen, Film, Plus, Trash2, FolderPlus, Pencil, Check, X } from 'lucide-react'
import type { Node, Edge } from '@xyflow/react'
import {
  buildChapterList,
  buildSceneList,
  toChineseNumber,
  normalizeChapterTitle,
  type ChapterInfo,
} from './sceneGraph'
import { loadLibraryScenes } from '../lib/libraryData'
import { resolveBgUrl } from './storyFlowchart/bgUrl'

interface SceneTreeProps {
  nodes: Node[]
  edges: Edge[]
  selectedSceneId: string | null
  onSelectScene: (sceneId: string) => void
  onAddScene: (chapter: string) => void
  onAddChapter: () => void
  onDeleteScene: (sceneId: string) => void
  onRenameScene: (sceneId: string, title: string) => void
  onRenameChapter: (chapterId: string, title: string) => void
  onDeleteChapter: (chapterId: string) => void
  canDeleteChapter: boolean
  /** 来自 project.chapters 的真实章节数据，优先于 buildChapterList */
  projectChapters?: Array<{ id: string; title: string; order: number }>
}

export default function SceneTree({
  nodes,
  edges,
  selectedSceneId,
  onSelectScene,
  onAddScene,
  onAddChapter,
  onDeleteScene,
  onRenameScene,
  onRenameChapter,
  onDeleteChapter,
  canDeleteChapter,
  projectChapters,
}: SceneTreeProps) {
  const confirm = useConfirm()
  const scenes = useMemo(() => buildSceneList(nodes, edges), [nodes, edges])
  const nodeChapters = useMemo(() => buildChapterList(nodes, edges), [nodes, edges])
  const libraryScenes = useMemo(() => loadLibraryScenes(), [])

  // 如果有 project.chapters 数据，用它来构建章节列表（更准确）
  const chapters: ChapterInfo[] = useMemo(() => {
    if (projectChapters && projectChapters.length > 0) {
      return projectChapters.map((ch) => {
        const title = ch.title || `第${toChineseNumber(ch.order)}章`
        const label = normalizeChapterTitle(title, ch.order - 1)
        // scene.chapter 是 sceneCode 的前缀（如 "1"），对应 ch.order
        const chapterId = String(ch.order)
        const nodeChapter = nodeChapters.find((nc) => nc.id === chapterId)
        return {
          id: chapterId,
          label,
          sceneCount: nodeChapter?.sceneCount || 0,
        }
      })
    }
    return nodeChapters
  }, [projectChapters, nodeChapters])
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editingSceneTitle, setEditingSceneTitle] = useState('')
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editingChapterTitle, setEditingChapterTitle] = useState('')


  // 场景重命名
  const startEditScene = (sceneId: string, currentTitle: string) => {
    setEditingSceneId(sceneId)
    setEditingSceneTitle(currentTitle)
  }
  const confirmEditScene = () => {
    const title = editingSceneTitle.trim()
    if (title && editingSceneId) onRenameScene(editingSceneId, title)
    setEditingSceneId(null)
  }
  const cancelEditScene = () => { setEditingSceneId(null) }

  // 章节重命名
  const startEditChapter = (chapterId: string) => {
    const ch = chapters.find((c) => c.id === chapterId)
    setEditingChapterId(chapterId)
    setEditingChapterTitle(ch?.label || '')
  }
  const confirmEditChapter = () => {
    const title = editingChapterTitle.trim()
    if (title && editingChapterId) onRenameChapter(editingChapterId, title)
    setEditingChapterId(null)
  }
  const cancelEditChapter = () => { setEditingChapterId(null) }

  return (
    <div className="flex h-full flex-col bg-white/80 backdrop-blur-sm">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-dream-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-dream-800">
          <BookOpen className="h-4 w-4 text-dream-500" />
          章节 / 场景
        </div>
        <button
          onClick={onAddChapter}
          title="新建章节"
          className="rounded-md p-1 text-dream-400 transition hover:bg-dream-50 hover:text-dream-600"
        >
          <FolderPlus className="h-4 w-4" />
        </button>
      </div>

      {/* 树状列表 — 只显示当前章节 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {(() => {
          // 当前章节：如果 projectChapters 有数据，取第一个（因为只加载了当前章节）；
          // 否则从 nodeChapters 取
          const currentChapter = chapters[0]
          if (!currentChapter || scenes.length === 0) {
            return (
              <div className="px-4 py-8 text-center text-sm text-dream-400">
                <Film className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {currentChapter ? `${currentChapter.label} · 还没有场景` : '还没有场景'}
                <button
                  onClick={() => onAddScene(currentChapter?.id || '1')}
                  className="mt-3 block w-full rounded-lg border border-dream-200 bg-dream-50 px-3 py-2 text-sm text-dream-600 transition hover:bg-dream-100"
                >
                  + 创建第一个场景
                </button>
              </div>
            )
          }

          const chapter = currentChapter
          const chapterScenes = scenes.filter((s) => s.chapter === chapter.id)

          return (
            <div className="mb-1">
              {/* 当前章节标题 */}
              <div className="group flex items-center gap-1 rounded-md bg-dream-50 px-2 py-1.5">
                {editingChapterId === chapter.id ? (
                  <div className="flex flex-1 items-center gap-1">
                    <input
                      value={editingChapterTitle}
                      onChange={(e) => setEditingChapterTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmEditChapter()
                        if (e.key === 'Escape') cancelEditChapter()
                      }}
                      onBlur={confirmEditChapter}
                      autoFocus
                      className="min-w-0 flex-1 rounded border border-dream-300 bg-white px-1.5 py-0.5 text-sm"
                    />
                    <button onClick={confirmEditChapter} className="rounded p-0.5 text-green-600 hover:bg-green-50">
                      <Check className="h-3 w-3" />
                    </button>
                    <button onClick={cancelEditChapter} className="rounded p-0.5 text-slate-400 hover:bg-slate-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <BookOpen className="h-3.5 w-3.5 text-dream-400" />
                    <span
                      className="flex-1 cursor-text text-sm font-semibold text-dream-700"
                      onDoubleClick={() => startEditChapter(chapter.id)}
                    >
                      {chapter.label}
                      <span className="ml-1 text-xs text-dream-400">({chapterScenes.length})</span>
                    </span>
                    <button
                      onClick={() => startEditChapter(chapter.id)}
                      title="重命名章节"
                      className="rounded p-0.5 text-dream-400 transition hover:bg-dream-100 hover:text-dream-600"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => onAddScene(chapter.id)}
                      title={`在${chapter.label}新建场景`}
                      className="rounded p-0.5 text-dream-400 transition hover:bg-dream-100 hover:text-dream-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    {canDeleteChapter && (
                      <button
                        onClick={() => onDeleteChapter(chapter.id)}
                        title="删除章节"
                        className="rounded p-0.5 text-dream-400 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* 场景列表 */}
              <div className="ml-2 mt-1 border-l border-dream-100 pl-2">
                {chapterScenes.map((scene) => {
                  const isSelected = selectedSceneId === scene.id
                  return (
                    <div
                      key={scene.id}
                      onClick={() => onSelectScene(scene.id)}
                      className={`group mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition ${
                        isSelected ? 'bg-dream-100 ring-1 ring-dream-300' : 'hover:bg-dream-50'
                      }`}
                    >
                      {/* 缩略图 */}
                      <div className="h-9 w-12 shrink-0 overflow-hidden rounded border border-dream-100 bg-dream-50">
                        {scene.backgroundId ? (
                          <img
                            src={resolveBgUrl(scene.backgroundId, libraryScenes)}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Film className="h-4 w-4 text-dream-200" />
                          </div>
                        )}
                      </div>

                      {/* 文字 */}
                      <div className="min-w-0 flex-1">
                        {editingSceneId === scene.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              value={editingSceneTitle}
                              onChange={(e) => setEditingSceneTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmEditScene()
                                if (e.key === 'Escape') cancelEditScene()
                              }}
                              onBlur={confirmEditScene}
                              autoFocus
                              className="min-w-0 flex-1 rounded border border-dream-300 bg-white px-1.5 py-0.5 text-sm"
                            />
                            <button onClick={confirmEditScene} className="rounded p-0.5 text-green-600 hover:bg-green-50">
                              <Check className="h-3 w-3" />
                            </button>
                            <button onClick={cancelEditScene} className="rounded p-0.5 text-slate-400 hover:bg-slate-100">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono text-dream-400">{scene.code}</span>
                              <span
                                className="cursor-text truncate text-sm font-medium text-dream-700"
                                onDoubleClick={(e) => {
                                  e.stopPropagation()
                                  startEditScene(scene.id, scene.title)
                                }}
                              >
                                {scene.title}
                              </span>
                            </div>
                            <div className="truncate text-xs text-dream-400">
                              {scene.preview || `${scene.cardCount} 个镜头`}
                            </div>
                          </>
                        )}
                      </div>

                      {editingSceneId !== scene.id && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditScene(scene.id, scene.title)
                            }}
                            title="重命名（或双击标题）"
                            className="rounded p-1 text-dream-300 transition hover:bg-dream-50 hover:text-dream-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {/* 删除按钮 */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (await confirm({ message: `确定删除场景「${scene.title}」吗？该场景的所有镜头卡都会被删除。`, danger: true })) {
                                onDeleteScene(scene.id)
                              }
                            }}
                            title="删除场景"
                            className="rounded p-1 text-dream-300 transition hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => onAddScene(chapter.id)}
                  className="mt-1 w-full rounded-lg border border-dashed border-dream-200 px-2 py-1.5 text-xs text-dream-400 transition hover:border-dream-300 hover:bg-dream-50 hover:text-dream-500"
                >
                  + 新建场景
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* 底部统计 */}
      <div className="border-t border-dream-100 px-4 py-2 text-xs text-dream-400">
        {chapters.length > 0 ? `${chapters[0].label} · ${scenes.length} 场景 · ${nodes.length} 节点` : `${nodes.length} 节点`}
      </div>
    </div>
  )
}
