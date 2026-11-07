// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteChapter, getProject, saveChapter, type ProjectDetail } from '../api/client'
import { useEditorStore } from '../stores/editorStore'
import FlowEditor from './FlowEditor'
import type ShotCardEditor from './ShotCardEditor'

vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), getProject: vi.fn(), deleteChapter: vi.fn(), saveChapter: vi.fn(), pauseProjectVoicePreparation: vi.fn(async () => ({})) }))
vi.mock('../components/FeedbackProvider', () => ({ useConfirm: () => async () => true, useToast: () => ({ info: vi.fn(), error: vi.fn(), success: vi.fn() }) }))
vi.mock('./SceneTree', () => ({ default: ({ selectedSceneId, onDeleteChapter }: { selectedSceneId: string; onDeleteChapter: (id: string) => void }) => <div><p data-testid="selected-scene">{selectedSceneId}</p>{['c1', 'c2', 'c3'].map(id => <button key={id} onClick={() => onDeleteChapter(id)}>delete-{id}</button>)}</div> }))
vi.mock('./ShotCardEditor', () => ({ default: ({ nodes, edges, onUpdateGraph, onSelectCard, selectedCardId }: ComponentProps<typeof ShotCardEditor>) => <div><p data-testid="selected-card">{selectedCardId}</p><button onClick={() => { onUpdateGraph(nodes.map(n => ({ ...n, data: { ...n.data, text: '尚未保存的正文' } })), edges); onSelectCard(nodes[0]!.id) }}>改正文</button></div> }))
vi.mock('../agent/AgentWorkspace', () => ({ default: () => null }))
vi.mock('./MiniPreview', () => ({ default: () => null }))
vi.mock('../voice/AutomaticVoiceBar', () => ({ default: () => null }))
vi.mock('./ProjectVoicePanel', () => ({ default: () => null }))

function fixture(): ProjectDetail {
  return { id: 'p', title: '故事', characters: [], chapters: ['一', '二', '三'].map((title, i) => ({
    id: `c${i + 1}`, title: `第${title}章`, order: i, version: i + 1,
    nodes: [{ nodeId: `line${i + 1}`, type: 'dialogue', positionX: 0, positionY: 0, data: JSON.stringify({ text: '已存正文', role: '旁白', sceneGroupId: `scene${i + 1}`, sceneCode: '1-1' }) }], edges: [],
  })) } as unknown as ProjectDetail
}
async function mount() {
  render(<MemoryRouter initialEntries={['/editor/p']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/editor/:projectId" element={<FlowEditor />} /></Routes></MemoryRouter>)
  await waitFor(() => expect(useEditorStore.getState().chapterId).toBe('c1'))
}

describe('chapter deletion preserves the author workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useEditorStore.getState().setChapterId(null)
    useEditorStore.getState().hydrateGraph([], [])
    vi.mocked(getProject).mockResolvedValue(fixture())
    vi.mocked(saveChapter).mockResolvedValue({ version: 7 })
    vi.mocked(deleteChapter).mockResolvedValue(undefined)
  })
  afterEach(() => { cleanup(); localStorage.clear() })

  it('deletes another chapter without hydrating away dirty text, selection, or undo', async () => {
    await mount()
    fireEvent.click(screen.getByRole('button', { name: '第二章' }))
    await waitFor(() => expect(useEditorStore.getState().chapterId).toBe('c2'))
    fireEvent.click(screen.getByText('改正文'))
    const before = useEditorStore.getState()
    const fresh = fixture(); fresh.chapters = fresh.chapters.filter(ch => ch.id !== 'c3')
    vi.mocked(getProject).mockResolvedValue(fresh)
    fireEvent.click(screen.getByText('delete-c3'))
    await waitFor(() => expect(deleteChapter).toHaveBeenCalledWith('p', 'c3'))
    await act(async () => {})
    const after = useEditorStore.getState()
    expect(after.chapterId).toBe('c2')
    expect(after.nodes).toBe(before.nodes)
    expect(after.edges).toBe(before.edges)
    expect(after.history).toBe(before.history)
    expect(screen.getByTestId('selected-card').textContent).toBe('line2')
    expect(screen.getByTestId('selected-scene').textContent).toBe('scene2')
  })

  it('waits for the active save before deleting the current chapter and loading its successor', async () => {
    await mount()
    let finishSave!: (result: { version: number }) => void
    vi.mocked(saveChapter).mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve }))
    fireEvent.click(screen.getByText('改正文'))
    fireEvent.click(screen.getByRole('button', { name: /^(保存|已保存)$/ }))
    await waitFor(() => expect(saveChapter).toHaveBeenCalledOnce())
    const fresh = fixture(); fresh.chapters = fresh.chapters.filter(ch => ch.id !== 'c1')
    vi.mocked(getProject).mockResolvedValue(fresh)
    fireEvent.click(screen.getByText('delete-c1'))
    await act(async () => {})
    expect(deleteChapter).not.toHaveBeenCalled()
    await act(async () => finishSave({ version: 7 }))
    await waitFor(() => expect(useEditorStore.getState().chapterId).toBe('c2'))
    expect(deleteChapter).toHaveBeenCalledWith('p', 'c1')
    expect(useEditorStore.getState().chapterVersion).toBe(2)
    expect(useEditorStore.getState().nodes[0]!.id).toBe('line2')
    expect(screen.getByTestId('selected-card').textContent).toBe('')
    expect(useEditorStore.getState().canUndo).toBe(false)
  })

  it('retains dirty text and undo when deleting the current chapter fails', async () => {
    await mount()
    fireEvent.click(screen.getByText('改正文'))
    const before = useEditorStore.getState()
    vi.mocked(deleteChapter).mockRejectedValueOnce(new Error('删除失败'))
    fireEvent.click(screen.getByText('delete-c1'))
    await waitFor(() => expect(deleteChapter).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByText('改正文')).toBeTruthy())
    expect(useEditorStore.getState().nodes).toBe(before.nodes)
    expect(useEditorStore.getState().history).toBe(before.history)
    expect(screen.getByTestId('selected-card').textContent).toBe('line1')
  })
})
