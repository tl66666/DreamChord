import { useEffect, useRef } from 'react'
import { useConfirm } from '../../components/FeedbackProvider'
import { Pencil, Edit3, Plus, Copy, Trash2, FolderPlus, Maximize } from 'lucide-react'
import type { ContextMenuState } from './types'
import type { Scene } from '../sceneGraph'

interface ContextMenuProps {
  state: ContextMenuState
  scene: Scene | null
  onClose: () => void
  onEditScene: (sceneId: string) => void
  onRenameScene: (sceneId: string) => void
  onDeleteScene: (sceneId: string) => void
  onAddSceneAfter: (sceneId: string) => void
  onAddScene: (chapter: string) => void
  onAddChapter: () => void
  onFitToScreen: () => void
}

export default function ContextMenu({ state, scene, onClose, onEditScene, onRenameScene, onDeleteScene, onAddSceneAfter, onAddScene, onAddChapter, onFitToScreen }: ContextMenuProps) {
  const confirm = useConfirm()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state.visible) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onEsc)
    }
  }, [state.visible, onClose])

  if (!state.visible) return null

  const items = state.targetSceneId ? [
    { icon: Edit3, label: '编辑场景', action: () => onEditScene(state.targetSceneId!) },
    { icon: Pencil, label: '重命名', action: () => onRenameScene(state.targetSceneId!) },
    { icon: Plus, label: '在此后添加场景', action: () => onAddSceneAfter(state.targetSceneId!) },
    { icon: Copy, label: '复制场景代码', action: () => navigator.clipboard?.writeText(scene?.code || '') },
    { icon: Trash2, label: '删除场景', danger: true, action: async () => { if (await confirm({ message: `确定删除场景「${scene?.title || ''}」吗？`, danger: true })) onDeleteScene(state.targetSceneId!) } },
  ] : [
    { icon: Plus, label: '新建场景', action: () => onAddScene('1') },
    { icon: FolderPlus, label: '新建章节', action: onAddChapter },
    { icon: Maximize, label: '自适应缩放', action: onFitToScreen },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-lg border border-dream-200 bg-white py-1 shadow-xl"
      style={{ left: Math.min(state.x, window.innerWidth - 180), top: Math.min(state.y, window.innerHeight - 200) }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose() }}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-dream-50 ${
            item.danger ? 'text-red-600 hover:bg-red-50' : 'text-dream-700'
          }`}
        >
          <item.icon className="h-3.5 w-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  )
}
