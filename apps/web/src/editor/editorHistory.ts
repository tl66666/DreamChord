import type { Edge, Node } from '@xyflow/react'

export interface EditorGraph {
  nodes: Node[]
  edges: Edge[]
}

function snapshot(graph: EditorGraph): EditorGraph {
  return { nodes: structuredClone(graph.nodes), edges: structuredClone(graph.edges) }
}

export class EditorHistory {
  constructor(
    readonly current: EditorGraph,
    private readonly past: EditorGraph[],
    private readonly future: EditorGraph[],
    private readonly limit: number,
  ) {}

  get canUndo(): boolean { return this.past.length > 0 }
  get canRedo(): boolean { return this.future.length > 0 }

  commit(next: EditorGraph): EditorHistory {
    const past = [...this.past, snapshot(this.current)].slice(-this.limit)
    return new EditorHistory(snapshot(next), past, [], this.limit)
  }

  undo(): EditorHistory {
    const previous = this.past.at(-1)
    if (!previous) return this
    return new EditorHistory(snapshot(previous), this.past.slice(0, -1), [snapshot(this.current), ...this.future], this.limit)
  }

  redo(): EditorHistory {
    const next = this.future[0]
    if (!next) return this
    return new EditorHistory(snapshot(next), [...this.past, snapshot(this.current)].slice(-this.limit), this.future.slice(1), this.limit)
  }

  hydrate(next: EditorGraph): EditorHistory {
    return new EditorHistory(snapshot(next), [], [], this.limit)
  }
}

export function createEditorHistory(initial: EditorGraph, limit = 50): EditorHistory {
  return new EditorHistory(snapshot(initial), [], [], Math.max(1, limit))
}
