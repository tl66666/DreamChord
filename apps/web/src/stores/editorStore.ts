import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

export type NodeType =
  | 'dialogue'
  | 'choice'
  | 'background'
  | 'character'
  | 'transition'
  | 'subtitle'
  | 'delay'
  | 'condition'
  | 'setVariable'
  | 'jump'

export interface DialogueData {
  role: string
  text: string
}

export interface ChoiceData {
  choices: string[]
}

export interface BackgroundData {
  backgroundId: string
}

export interface CharacterData {
  characterId: string
  action: 'show' | 'hide' | 'move'
  expression: string
}

export interface ProjectData {
  id: string
  title: string
  description?: string
  cover?: string
  isPublic?: boolean
  isPublished?: boolean
}

interface EditorState {
  project: ProjectData | null
  chapterId: string | null
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  isLoading: boolean
  isSaving: boolean
  lastSavedAt: Date | null

  setProject: (project: ProjectData) => void
  setChapterId: (id: string | null) => void
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  setSelectedNodeId: (id: string | null) => void
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  addNode: (type: NodeType, data?: Record<string, unknown>) => void
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  setLastSavedAt: (date: Date) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  chapterId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isLoading: false,
  isSaving: false,
  lastSavedAt: null,

  setProject: (project) => set({ project }),
  setChapterId: (id) => set({ chapterId: id }),
  setNodes: (nodes) =>
    set((state) => ({
      nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes,
    })),
  setEdges: (edges) =>
    set((state) => ({
      edges: typeof edges === 'function' ? edges(state.edges) : edges,
    })),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  updateNodeData: (nodeId, data) => {
    const { nodes } = get()
    set({
      nodes: nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node,
      ),
    })
  },
  updateNodePosition: (nodeId, position) => {
    const { nodes } = get()
    set({
      nodes: nodes.map((node) =>
        node.id === nodeId ? { ...node, position } : node,
      ),
    })
  },
  addNode: (type, data = {}) => {
    const { nodes } = get()
    const id = `node-${crypto.randomUUID()}`
    const defaults: Record<string, Record<string, unknown>> = {
      dialogue: { role: '角色名', text: '' },
      choice: { choices: ['选项 1', '选项 2'] },
      background: { backgroundId: '/assets/backgrounds/bg-classroom.png' },
      character: { characterId: 'yuki', action: 'show', expression: 'normal', position: 'center' },
      transition: { effect: 'fade', duration: 1 },
      subtitle: { text: '', position: 'bottom', duration: 0 },
      delay: { seconds: 1 },
      condition: { variable: 'flag', operator: '==', value: 'true' },
      setVariable: { variable: 'flag', value: 'true' },
      jump: { targetScene: 'scene-2' },
    }
    const newNode: Node = {
      id,
      type,
      position: { x: 250 + Math.random() * 80, y: 120 + nodes.length * 90 },
      data: { ...defaults[type], ...data },
    }
    set({ nodes: [...nodes, newNode], selectedNodeId: id })
  },
  setLoading: (loading) => set({ isLoading: loading }),
  setSaving: (saving) => set({ isSaving: saving }),
  setLastSavedAt: (date) => set({ lastSavedAt: date }),
}))
