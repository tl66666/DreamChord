// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProject, saveChapter, type ProjectDetail } from '../api/client'
import { useEditorStore } from '../stores/editorStore'
import FlowEditor from './FlowEditor'

vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), getProject: vi.fn(), saveChapter: vi.fn(), pauseProjectVoicePreparation: vi.fn(async () => ({})) }))
vi.mock('../components/FeedbackProvider', () => ({ useConfirm: () => async () => true, useToast: () => ({ info: vi.fn(), error: vi.fn(), success: vi.fn() }) }))
vi.mock('../voice/AutomaticVoiceBar', () => ({ default: () => null }))

function fixture(): ProjectDetail {
  return { id: 'p', title: '故事', characters: [], chapters: [0, 1].map(i => ({
    id: `c${i + 1}`, title: `第${i + 1}章`, order: i, version: 1,
    nodes: [
      { nodeId: 'opening', type: 'subtitle', positionX: 0, positionY: 0, data: JSON.stringify({ text: `第${i + 1}章开场`, sceneGroupId: 's', sceneCode: `${i + 1}-1` }) },
      { nodeId: 'later', type: 'dialogue', positionX: 0, positionY: 100, data: JSON.stringify({ text: `第${i + 1}章后一句`, role: '旁白', sceneGroupId: 's', sceneCode: `${i + 1}-1` }) },
    ], edges: [{ edgeId: 'next', source: 'opening', target: 'later', animated: true }],
  })) } as unknown as ProjectDetail
}

function PlayerLocation() {
  const location = useLocation()
  return <output data-testid="player-location">{location.pathname}{location.search}</output>
}

async function mount() {
  render(<MemoryRouter initialEntries={['/editor/p']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
    <Route path="/editor/:projectId" element={<FlowEditor />} />
    <Route path="/play/:projectId" element={<PlayerLocation />} />
  </Routes></MemoryRouter>)
  await screen.findByText('第1章后一句')
}

function fullPreviewButton(entry: 'toolbar' | 'stage') {
  return screen.getAllByRole('button', { name: /^(完整)?预览$/ })[entry === 'toolbar' ? 0 : 1]!
}

async function playerUrl() {
  return new URL((await screen.findByTestId('player-location')).textContent!, 'https://example.test')
}

describe('editor preview entry points', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useEditorStore.getState().setChapterId(null)
    useEditorStore.getState().hydrateGraph([], [])
    vi.mocked(getProject).mockResolvedValue(fixture())
    vi.mocked(saveChapter).mockResolvedValue({ version: 2 })
  })
  afterEach(() => { cleanup(); localStorage.clear() })

  it.each(['toolbar', 'stage'] as const)('%s full preview starts at the work opening even after selecting a later card', async entry => {
    await mount()
    fireEvent.click(screen.getByText('第1章后一句'))
    fireEvent.click(fullPreviewButton(entry))
    const url = await playerUrl()
    expect(url.pathname).toBe('/play/p')
    expect(url.searchParams.has('preview')).toBe(true)
    expect(url.searchParams.get('from')).toBeNull()
    expect(url.searchParams.get('chapter')).toBeNull()
    expect(saveChapter).toHaveBeenCalledOnce()
  })

  it('full preview does not implicitly start at the selected scene when no card is selected', async () => {
    await mount()
    fireEvent.click(fullPreviewButton('toolbar'))
    expect((await playerUrl()).searchParams.get('from')).toBeNull()
  })

  it('full preview starts at the work opening after switching to a later chapter', async () => {
    await mount()
    fireEvent.click(screen.getByRole('button', { name: '第二章' }))
    await screen.findByText('第2章后一句')
    fireEvent.click(screen.getByText('第2章后一句'))
    fireEvent.click(fullPreviewButton('toolbar'))
    const url = await playerUrl()
    expect(url.searchParams.get('from')).toBeNull()
    expect(url.searchParams.get('chapter')).toBeNull()
  })

  it('only the explicit current-card preview sends the selected chapter and card', async () => {
    await mount()
    expect((screen.getByRole('button', { name: '从当前镜头预览' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '第二章' }))
    await screen.findByText('第2章后一句')
    fireEvent.click(screen.getByText('第2章后一句'))
    fireEvent.click(screen.getByRole('button', { name: '从当前镜头预览' }))
    expect((await playerUrl()).searchParams.get('from')).toBe('c2:later')
  })

  it.each(['full', 'current'] as const)('%s preview waits for a successful save before navigation', async entry => {
    await mount()
    fireEvent.click(screen.getByText('第1章后一句'))
    let finishSave!: (result: { version: number }) => void
    vi.mocked(saveChapter).mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve }))
    fireEvent.click(entry === 'full' ? fullPreviewButton('toolbar') : screen.getByRole('button', { name: '从当前镜头预览' }))
    await waitFor(() => expect(saveChapter).toHaveBeenCalledOnce())
    expect(screen.queryByTestId('player-location')).toBeNull()
    await act(async () => finishSave({ version: 2 }))
    expect((await playerUrl()).searchParams.get('from')).toBe(entry === 'current' ? 'c1:later' : null)
  })

  it.each(['full', 'current'] as const)('%s preview stays in the editor after a save conflict', async entry => {
    await mount()
    fireEvent.click(screen.getByText('第1章后一句'))
    vi.mocked(saveChapter).mockRejectedValueOnce({ response: { status: 409 } })
    fireEvent.click(entry === 'full' ? fullPreviewButton('toolbar') : screen.getByRole('button', { name: '从当前镜头预览' }))
    await screen.findByRole('button', { name: '版本冲突' })
    expect(screen.queryByTestId('player-location')).toBeNull()
    expect(useEditorStore.getState().nodes[1]!.data.text).toBe('第1章后一句')
  })
})
