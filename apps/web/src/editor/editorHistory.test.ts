import { describe, expect, it } from 'vitest'
import { createEditorHistory } from './editorHistory'

const graph = (id: string) => ({ nodes: [{ id, type: 'dialogue', position: { x: 0, y: 0 }, data: {} }], edges: [] })

describe('editor history', () => {
  it('supports bounded undo/redo and invalidates redo after a new edit', () => {
    let history = createEditorHistory(graph('a'), 2)
    history = history.commit(graph('b')).commit(graph('c')).commit(graph('d'))
    expect(history.undo().current.nodes[0]?.id).toBe('c')
    history = history.undo().commit(graph('x'))
    expect(history.canRedo).toBe(false)
    expect(history.undo().undo().current.nodes[0]?.id).toBe('b')
  })

  it('hydrates without creating an undo entry', () => {
    const history = createEditorHistory(graph('a')).commit(graph('b')).hydrate(graph('server'))
    expect(history.current.nodes[0]?.id).toBe('server')
    expect(history.canUndo).toBe(false)
  })
})
