import { useEffect } from 'react'
import type { Scene } from '../sceneGraph'
import type { CardPosition } from './types'

interface UseKeyboardNavParams {
  scenes: Scene[]
  positions: Map<string, CardPosition>
  selectedSceneId: string | null
  onSelectScene: (id: string) => void
  onEditScene: (id: string) => void
  onDeleteScene: (id: string) => void
  onRenameScene: (id: string) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToScreen: () => void
  onFocusSearch: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

function findAdjacentScene(
  currentId: string | null,
  direction: string,
  positions: Map<string, CardPosition>,
  scenes: Scene[],
): string | null {
  if (!currentId) return scenes[0]?.id || null
  const current = positions.get(currentId)
  if (!current) return null

  const candidates: Array<{ scene: Scene; pos: CardPosition }> = []
  scenes.forEach(s => {
    if (s.id === currentId) return
    const pos = positions.get(s.id)
    if (pos) candidates.push({ scene: s, pos })
  })

  let best: { id: string; dist: number } | null = null
  for (const { scene, pos } of candidates) {
    const dx = pos.x - current.x
    const dy = pos.y - current.y
    let valid = false
    let dist = 0
    switch (direction) {
      case 'ArrowLeft':  valid = dx < -10; dist = Math.abs(dx) + Math.abs(dy) * 2; break
      case 'ArrowRight': valid = dx > 10;  dist = Math.abs(dx) + Math.abs(dy) * 2; break
      case 'ArrowUp':    valid = dy < -10; dist = Math.abs(dy) + Math.abs(dx) * 2; break
      case 'ArrowDown':  valid = dy > 10;  dist = Math.abs(dy) + Math.abs(dx) * 2; break
    }
    if (valid && (!best || dist < best.dist)) {
      best = { id: scene.id, dist }
    }
  }
  return best?.id || null
}

export function useKeyboardNav({
  scenes, positions, selectedSceneId, onSelectScene,
  onEditScene, onDeleteScene, onRenameScene,
  onZoomIn, onZoomOut, onFitToScreen, onFocusSearch, containerRef,
}: UseKeyboardNavParams) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = containerRef.current
      if (!el) return
      // 如果焦点在 input/textarea 中则不拦截
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

      // Ctrl+F 聚焦搜索
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        onFocusSearch()
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault()
          const next = findAdjacentScene(selectedSceneId, e.key, positions, scenes)
          if (next) onSelectScene(next)
          break
        }
        case 'Enter':
          if (selectedSceneId) { e.preventDefault(); onEditScene(selectedSceneId) }
          break
        case 'F2':
          if (selectedSceneId) { e.preventDefault(); onRenameScene(selectedSceneId) }
          break
        case 'Delete':
          if (selectedSceneId) { e.preventDefault(); onDeleteScene(selectedSceneId) }
          break
        case '+': case '=':
          e.preventDefault(); onZoomIn()
          break
        case '-':
          e.preventDefault(); onZoomOut()
          break
        case '0':
          e.preventDefault(); onFitToScreen()
          break
        case 'Escape':
          onSelectScene('')
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [scenes, positions, selectedSceneId, onSelectScene, onEditScene, onDeleteScene, onRenameScene, onZoomIn, onZoomOut, onFitToScreen, onFocusSearch, containerRef])
}
