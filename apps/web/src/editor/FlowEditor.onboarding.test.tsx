// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '../components/FeedbackProvider'
import { getProject } from '../api/client'
import FlowEditor from './FlowEditor'

vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), getProject: vi.fn(), pauseProjectVoicePreparation: vi.fn(async () => ({})) }))
vi.mock('./SceneTree', () => ({ default: (props: { selectedSceneId: string }) => <p data-testid="selected-scene">{props.selectedSceneId}</p> }))
vi.mock('./ShotCardEditor', () => ({ default: () => null }))
vi.mock('./MiniPreview', () => ({ default: () => null }))
vi.mock('../voice/AutomaticVoiceBar', () => ({ default: () => null }))
describe('first creator entry', () => {
  afterEach(cleanup)
  it('keeps the starter selected when an older StrictMode request resolves last', async () => {
    const pending: Array<(value: unknown) => void> = []
    vi.mocked(getProject).mockImplementation(() => new Promise(resolve => pending.push(resolve as (value: unknown) => void)))
    const project = { id: 'copy', title: 'copy', cover: '', chapters: [{ id: 'c', title: '第一章', version: 1, order: 0, nodes: [
      { nodeId: 'first', type: 'subtitle', positionX: 0, positionY: 0, data: JSON.stringify({ text: '开场', sceneGroupId: 'intro' }) },
      { nodeId: 'mine', type: 'dialogue', positionX: 0, positionY: 100, data: JSON.stringify({ text: '结局', role: '许栀', sceneGroupId: 'your-ending', creatorStarter: true }) },
    ], edges: [{ edgeId: 'e', source: 'first', target: 'mine', animated: true }] }], characters: [] }
    render(<StrictMode><MemoryRouter initialEntries={['/editor/copy?welcome=curtain']}><FeedbackProvider><Routes><Route path="/editor/:projectId" element={<FlowEditor />} /></Routes></FeedbackProvider></MemoryRouter></StrictMode>)
    await waitFor(() => expect(pending).toHaveLength(2))
    await act(async () => pending[1]!(project))
    await waitFor(() => expect(screen.getByTestId('selected-scene').textContent).toBe('your-ending'))
    await act(async () => pending[0]!(project))
    expect(screen.getByTestId('selected-scene').textContent).toBe('your-ending')
  })
})
