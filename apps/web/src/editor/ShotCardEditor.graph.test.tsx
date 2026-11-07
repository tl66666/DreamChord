// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { voiceTextHash } from '@dreamchord/story-domain'
import { FeedbackProvider } from '../components/FeedbackProvider'
import { useEditorStore } from '../stores/editorStore'
import ShotCardEditor from './ShotCardEditor'
import { findSceneStartNode, getSceneGroupNodes, groupNodesToCards } from './sceneGraph'

vi.mock('./NodeLocalizationEditor', () => ({ default: () => null }))

const node = (id: string, type = 'dialogue', sceneGroupId = 's'): Node => ({
  id, type, position: { x: 0, y: 0 },
  data: { text: id, role: '旁白', backgroundId: id, sceneGroupId, sceneCode: '1-1' },
})
const edge = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target })
const chain = (...ids: string[]) => ids.slice(0, -1).map((id, i) => edge(id, ids[i + 1]!))
function mount(nodes: Node[], edges: Edge[], edit: string | null = null) {
  useEditorStore.getState().hydrateGraph(nodes, edges)
  function Harness() {
    const state = useEditorStore()
    return <ShotCardEditor nodes={state.nodes} edges={state.edges} selectedSceneId="s" selectedCardId={edit}
      autoEditCardId={edit} onConsumeAutoEdit={vi.fn()} onSelectCard={vi.fn()}
      onUpdateGraph={state.commitGraph} scenes={[]} onCreateBranch={vi.fn()} onNavigateToScene={vi.fn()}
      onRequestAI={vi.fn()} onSetSceneExit={vi.fn()} convergenceMap={new Map()}
      onOpenAssetPicker={vi.fn()} onAssetApplied={vi.fn()} />
  }
  return render(<FeedbackProvider><Harness /></FeedbackProvider>)
}
function cardButton(text: string, title: string) {
  const card = screen.getAllByText(text).map(element => element.closest('.group')).find(Boolean) as HTMLElement
  return within(card).getByTitle(title)
}
function sceneCards() {
  const { nodes, edges } = useEditorStore.getState()
  const start = findSceneStartNode('s', nodes, edges)!
  return groupNodesToCards(getSceneGroupNodes(start, nodes, edges))
}

describe('shot graph author operations', () => {
  afterEach(() => { cleanup(); localStorage.clear() })

  it.each([['A', '下移'], ['B', '上移']])('moves %s with both scene boundaries and one undo', (id, title) => {
    const nodes = [node('P', 'dialogue', 'previous'), node('Abg', 'background'), node('A'), node('Bbg', 'background'), node('B'), node('Q', 'dialogue', 'next')]
    const entry: Edge = { ...edge('P', 'Abg'), sourceHandle: 'choice-1', label: '进入' }
    const edges = [entry, ...chain('Abg', 'A', 'Bbg', 'B', 'Q')]
    mount(nodes, edges)
    fireEvent.click(cardButton(id, title))
    expect(sceneCards().map(card => card.id)).toEqual(['B', 'A'])
    expect(useEditorStore.getState().edges).toContainEqual({ ...entry, target: 'Bbg' })
    expect(useEditorStore.getState().edges.some(e => e.source === 'A' && e.target === 'Q')).toBe(true)
    act(() => useEditorStore.getState().undo())
    expect(useEditorStore.getState().nodes).toEqual(nodes)
    expect(useEditorStore.getState().edges).toEqual(edges)
    expect(useEditorStore.getState().canUndo).toBe(false)
  })

  it('moves cards sharing one background without duplicating or losing their neighbours', () => {
    mount([node('bg', 'background'), node('P'), node('A'), node('B'), node('Q')], chain('bg', 'P', 'A', 'B', 'Q'))
    fireEvent.click(cardButton('A', '下移'))
    expect(sceneCards().map(card => card.id)).toEqual(['P', 'B', 'A', 'Q'])
    expect(sceneCards().map(card => card.background)).toEqual(['bg', 'bg', 'bg', 'bg'])
    expect(useEditorStore.getState().nodes.filter(n => n.type === 'background')).toHaveLength(1)
  })

  it('keeps each background when moving between two shared background runs', () => {
    mount([node('abg', 'background'), node('P'), node('A'), node('bbg', 'background'), node('B'), node('Q')], chain('abg', 'P', 'A', 'bbg', 'B', 'Q'))
    fireEvent.click(cardButton('A', '下移'))
    expect(sceneCards().map(card => [card.id, card.background])).toEqual([['P', 'abg'], ['B', 'bbg'], ['A', 'abg'], ['Q', 'bbg']])
  })

  it('preserves a choice entry when deleting the first card of its branch', () => {
    const entry: Edge = { ...edge('outside-choice', 'bg'), sourceHandle: 'choice-1', label: '走右边' }
    mount([node('outside-choice', 'choice', 'other'), node('bg', 'background'), node('A'), node('Bbg', 'background'), node('B')], [entry, ...chain('bg', 'A', 'Bbg', 'B')])
    fireEvent.click(cardButton('A', '删除'))
    expect(useEditorStore.getState().edges).toContainEqual({ ...entry, target: 'Bbg' })
    expect(sceneCards().map(card => card.id)).toEqual(['B'])
    act(() => useEditorStore.getState().undo())
    expect(useEditorStore.getState().edges).toContainEqual(entry)
    expect(useEditorStore.getState().canUndo).toBe(false)
  })

  it('deletes a middle card sharing its background without bypassing earlier dialogue', () => {
    mount([node('bg', 'background'), node('P'), node('A'), node('B')], chain('bg', 'P', 'A', 'B'))
    fireEvent.click(cardButton('A', '删除'))
    expect(sceneCards().map(card => card.id)).toEqual(['P', 'B'])
    expect(useEditorStore.getState().edges).not.toContainEqual(expect.objectContaining({ source: 'bg', target: 'B' }))
  })

  it('removes a choice while retaining the remaining destinations and one undo', () => {
    const choice = { ...node('choice', 'choice'), data: { sceneGroupId: 's', sceneCode: '1-1', choices: ['左路', '中路', '右路'], localizations: { ja: { choices: ['左', '中', '右'], sourceHash: voiceTextHash('左路\n中路\n右路') } } } }
    const nodes = [choice, node('left', 'dialogue', 'left-scene'), node('middle', 'dialogue', 'middle-scene'), node('right', 'dialogue', 'right-scene')]
    const edges = ['left', 'middle', 'right'].map((target, i) => ({ ...edge('choice', target), sourceHandle: `choice-${i}`, label: ['左路', '中路', '右路'][i] }))
    mount(nodes, edges, 'choice')
    const input = screen.getByDisplayValue('左路')
    fireEvent.click(input.parentElement!.querySelector('button')!)
    expect(useEditorStore.getState().edges.filter(e => e.source === 'choice').map(e => [e.sourceHandle, e.target, e.label])).toEqual([
      ['choice-0', 'middle', '中路'], ['choice-1', 'right', '右路'],
    ])
    expect(useEditorStore.getState().nodes.some(n => n.id === 'left')).toBe(true)
    expect(useEditorStore.getState().nodes.find(n => n.id === 'choice')!.data.localizations).toEqual({ ja: { choices: ['中', '右'], sourceHash: voiceTextHash('中路\n右路') } })
    act(() => useEditorStore.getState().undo())
    expect(useEditorStore.getState().nodes).toEqual(nodes)
    expect(useEditorStore.getState().edges).toEqual(edges)
    expect(useEditorStore.getState().canUndo).toBe(false)
  })

  it('keeps choice destinations when moving its card, and leaves boundary moves disabled', () => {
    const choice = { ...node('choice', 'choice'), data: { choices: ['走出去'], sceneGroupId: 's', sceneCode: '1-1' } }
    const branch: Edge = { ...edge('choice', 'outside'), sourceHandle: 'choice-0', label: '走出去' }
    mount([node('bg', 'background'), node('A'), choice, node('outside', 'dialogue', 'other')], [...chain('bg', 'A', 'choice'), branch])
    const firstUp = cardButton('A', '上移') as HTMLButtonElement
    expect(firstUp.disabled).toBe(true)
    expect((screen.getAllByTitle('下移')[1] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getAllByTitle('上移')[1]!)
    expect(sceneCards().map(card => card.id)).toEqual(['choice', 'A'])
    expect(useEditorStore.getState().edges).toContainEqual(branch)
  })
})
