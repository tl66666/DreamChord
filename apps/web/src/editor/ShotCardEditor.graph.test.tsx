// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { voiceTextHash } from '@dreamchord/story-domain'
import { FeedbackProvider } from '../components/FeedbackProvider'
import { useEditorStore } from '../stores/editorStore'
import { CHARACTER_KEY, SCENE_KEY } from '../lib/libraryData'
import ShotCardEditor from './ShotCardEditor'
import { findSceneStartNode, getSceneGroupNodes, groupNodesToCards } from './sceneGraph'
import { resolveStageStateAfterNode } from './workbench/storyEditorGraph'

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

  it('duplicates the final card without mutating the graph captured for undo', () => {
    const nodes = [node('bg', 'background'), node('A')]
    const edges = chain('bg', 'A')
    mount(nodes, edges)
    fireEvent.click(cardButton('A', '复制卡片'))
    expect(sceneCards()).toHaveLength(2)
    act(() => useEditorStore.getState().undo())
    expect(useEditorStore.getState().nodes).toEqual(nodes)
    expect(useEditorStore.getState().edges).toEqual(edges)
    expect(useEditorStore.getState().canUndo).toBe(false)
  })

  it('persists the automatic speaker staging toggle and restores it with one undo', () => {
    const speaker = { ...node('A'), data: { ...node('A').data, role: 'yuki', autoStageSpeaker: true } }
    mount([speaker], [], 'A')
    fireEvent.click(screen.getByRole('checkbox', { name: /自动登场/ }))
    expect(useEditorStore.getState().nodes.find(item => item.id === 'A')!.data.autoStageSpeaker).toBe(false)
    act(() => useEditorStore.getState().undo())
    expect(useEditorStore.getState().nodes).toEqual([speaker])
    expect(useEditorStore.getState().canUndo).toBe(false)
  })

  it('edits audio without rebuilding the first card of a shared background chain', () => {
    const character = { ...node('char', 'character'), data: { sceneGroupId: 's', sceneCode: '1-1', characterId: 'yuki', expression: 'normal', position: 'left', action: 'show' } }
    const nodes = [node('bg', 'background'), character, node('A'), node('B')]
    const edges = chain('bg', 'char', 'A', 'B')
    mount(nodes, edges, 'A')
    fireEvent.change(screen.getByRole('combobox', { name: 'BGM 动作' }), { target: { value: 'stop' } })
    expect(useEditorStore.getState().nodes.map(item => item.id)).toEqual(nodes.map(item => item.id))
    expect(useEditorStore.getState().edges).toEqual(edges)
    expect(useEditorStore.getState().nodes.find(item => item.id === 'A')!.data.audio).toEqual({ bgm: { action: 'stop' } })
    expect(sceneCards().map(item => item.id)).toEqual(['A', 'B'])
    act(() => useEditorStore.getState().undo())
    expect(useEditorStore.getState().nodes).toEqual(nodes)
    expect(useEditorStore.getState().edges).toEqual(edges)
    expect(useEditorStore.getState().canUndo).toBe(false)
  })

  it.each(['dialogue', 'narration', 'thought', 'memory', 'system'])('edits %s text while retaining node identity, localization and routing', (lensType) => {
    const subtitle = ['narration', 'memory', 'system'].includes(lensType)
    const line = { ...node('A', subtitle ? 'subtitle' : 'dialogue'), data: { ...node('A').data, lensType, localizations: { ja: { text: '元の台詞' } }, voiceTracks: { ja: { url: '/ja.wav', textHash: 'old-text' } } } }
    const nodes = [line, node('B')]
    const edges = chain('A', 'B')
    mount(nodes, edges, 'A')
    const input = screen.getByDisplayValue('A')
    fireEvent.change(input, { target: { value: '修改后的文字' } })
    fireEvent.blur(input)
    expect(useEditorStore.getState().nodes[0]).toEqual({ ...line, data: { ...line.data, text: '修改后的文字' } })
    expect(useEditorStore.getState().edges).toEqual(edges)
    act(() => useEditorStore.getState().undo())
    expect(useEditorStore.getState().nodes).toEqual(nodes)
    expect(useEditorStore.getState().canUndo).toBe(false)
  })

  it('connects a new background when editing the first card sharing its background', () => {
    localStorage.setItem(SCENE_KEY, JSON.stringify([{ id: 'room', name: '房间', url: '/room.png' }]))
    const nodes = [node('bg', 'background'), node('A'), node('B')]
    const edges = chain('bg', 'A', 'B')
    mount(nodes, edges, 'A')
    const select = screen.getByRole('option', { name: '房间' }).closest('select')!
    fireEvent.change(select, { target: { value: 'room' } })
    const graph = useEditorStore.getState()
    expect(resolveStageStateAfterNode(graph.nodes, graph.edges, 'A').backgroundId).toBe('/room.png')
    expect(sceneCards().map(item => item.id)).toEqual(['A', 'B'])
    act(() => graph.undo())
    expect(useEditorStore.getState().nodes).toEqual(nodes)
    expect(useEditorStore.getState().edges).toEqual(edges)
  })

  function stageFixture() {
    localStorage.setItem(CHARACTER_KEY, JSON.stringify([{ id: 'yuki', name: '雪', defaultExpression: 'normal', expressions: [{ id: 'normal', label: '平静', url: '/normal.png' }, { id: 'smile', label: '微笑', url: '/smile.png' }] }]))
    const character = { ...node('char', 'character'), data: { sceneGroupId: 's', sceneCode: '1-1', characterId: 'yuki', expression: 'normal', position: 'right', action: 'show' } }
    const line = (id: string) => ({ ...node(id), data: { ...node(id).data, role: 'yuki', autoStageSpeaker: true } })
    return { nodes: [node('bg', 'background'), character, line('A'), line('B')], edges: chain('bg', 'char', 'A', 'B') }
  }

  it.each([
    ['A', 0, 'expression'], ['B', 0, 'expression'], ['B', 1, 'expression'],
    ['B', 0, 'position'], ['B', 1, 'position'],
  ] as const)('commits %s control %s %s without changing preceding stage', (id, controlIndex, field) => {
    const { nodes, edges } = stageFixture()
    mount(nodes, edges, id)
    const controls = screen.getAllByRole('combobox').filter(element => (element as HTMLSelectElement).value === (field === 'expression' ? 'normal' : 'right'))
    fireEvent.change(controls[controlIndex]!, { target: { value: field === 'expression' ? 'smile' : 'left' } })
    const graph = useEditorStore.getState()
    expect(resolveStageStateAfterNode(graph.nodes, graph.edges, id).characters.find(item => item.characterId === 'yuki')?.[field]).toBe(field === 'expression' ? 'smile' : 'left')
    if (id === 'B') expect(resolveStageStateAfterNode(graph.nodes, graph.edges, 'A').characters[0]?.[field]).toBe(field === 'expression' ? 'normal' : 'right')
    expect(sceneCards().map(item => item.id)).toEqual(['A', 'B'])
    act(() => graph.undo())
    expect(useEditorStore.getState().nodes).toEqual(nodes)
    expect(useEditorStore.getState().edges).toEqual(edges)
    expect(useEditorStore.getState().canUndo).toBe(false)
  })

  it('lets an inherited speaking character leave instead of automatically adding them back', () => {
    const { nodes, edges } = stageFixture()
    mount(nodes, edges, 'B')
    fireEvent.click(screen.getByTitle('让角色退场'))
    const graph = useEditorStore.getState()
    expect(resolveStageStateAfterNode(graph.nodes, graph.edges, 'B').characters).toEqual([])
    expect(graph.nodes.find(item => item.id === 'B')!.data.autoStageSpeaker).toBe(false)
    expect(resolveStageStateAfterNode(graph.nodes, graph.edges, 'A').characters).toHaveLength(1)
  })

  it('preserves all choice entry handles when rebuilding the first staged card', () => {
    const { nodes, edges } = stageFixture()
    const entries: Edge[] = [
      { ...edge('outside-choice', 'char'), sourceHandle: 'choice-0', label: '左路' },
      { ...edge('outside-choice', 'char'), id: 'second-entry', sourceHandle: 'choice-1', label: '右路' },
    ]
    mount([node('outside-choice', 'choice', 'outside'), ...nodes.filter(item => item.id !== 'bg')], [...entries, ...edges.filter(item => item.source !== 'bg')], 'A')
    const select = screen.getAllByRole('combobox').find(element => (element as HTMLSelectElement).value === 'normal')!
    fireEvent.change(select, { target: { value: 'smile' } })
    const graph = useEditorStore.getState()
    const nextEntries = graph.edges.filter(item => item.source === 'outside-choice')
    expect(nextEntries.map(item => [item.id, item.sourceHandle, item.label])).toEqual(entries.map(item => [item.id, item.sourceHandle, item.label]))
    for (const entry of nextEntries) expect(graph.nodes.some(item => item.id === entry.target)).toBe(true)
    expect(resolveStageStateAfterNode(graph.nodes, graph.edges, 'A').characters[0]?.expression).toBe('smile')
  })

  it.each(['stage', 'background'])('routes direct text entrances through the edited %s', (field) => {
    const { nodes, edges } = stageFixture()
    localStorage.setItem(SCENE_KEY, JSON.stringify([{ id: 'room', name: '房间', url: '/room.png' }]))
    const outsideStage = { ...nodes[1]!, id: 'outside-stage', data: { ...nodes[1]!.data, sceneGroupId: 'outside' } }
    const directEntries: Edge[] = [
      { ...edge('X', 'A'), label: '直接进入' },
      { ...edge('outside-choice', 'A'), sourceHandle: 'choice-0', label: '选择进入' },
    ]
    const originalNodes = [...nodes, outsideStage, node('X', 'dialogue', 'outside'), { ...node('outside-choice', 'choice', 'outside'), data: { sceneGroupId: 'outside', choices: ['选择进入'] } }]
    const originalEdges = [...edges, edge('outside-stage', 'X'), edge('outside-stage', 'outside-choice'), ...directEntries]
    mount(originalNodes, originalEdges, 'A')
    if (field === 'stage') {
      const select = screen.getAllByRole('combobox').find(element => (element as HTMLSelectElement).value === 'normal')!
      fireEvent.change(select, { target: { value: 'smile' } })
    } else {
      fireEvent.change(screen.getByRole('option', { name: '房间' }).closest('select')!, { target: { value: 'room' } })
    }
    const graph = useEditorStore.getState()
    const stagedEntry = graph.edges.find(item => item.source === 'bg')!.target
    for (const entry of directEntries) expect(graph.edges.find(item => item.id === entry.id)).toEqual({ ...entry, target: stagedEntry })
    const effective = resolveStageStateAfterNode(graph.nodes, graph.edges, 'A')
    if (field === 'stage') expect(effective.characters[0]?.expression).toBe('smile')
    else expect(effective.backgroundId).toBe('/room.png')
    act(() => graph.undo())
    expect(useEditorStore.getState().nodes).toEqual(originalNodes)
    expect(useEditorStore.getState().edges).toEqual(originalEdges)
  })
})
