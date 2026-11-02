// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '../components/FeedbackProvider'
import { CHARACTER_KEY } from '../lib/libraryData'
import ShotCardEditor from './ShotCardEditor'
import type { Node } from '@xyflow/react'
vi.mock('./NodeLocalizationEditor', () => ({ default: () => null }))

describe('legacy graph character edits', () => {
  afterEach(() => { cleanup(); localStorage.clear() })
  it('selects a card for preview when its edit control is opened', () => {
    const select = vi.fn()
    render(<FeedbackProvider><ShotCardEditor nodes={[{ id: 'line', type: 'subtitle', position: { x: 0, y: 0 }, data: { text: '雨停了', sceneGroupId: 's', sceneCode: '1-1' } }]} edges={[]} selectedSceneId="s" selectedCardId={null} autoEditCardId={null} onConsumeAutoEdit={vi.fn()} onSelectCard={select} onUpdateGraph={vi.fn()} onRequestAI={vi.fn()} onSetSceneExit={vi.fn()} scenes={[]} onCreateBranch={vi.fn()} onNavigateToScene={vi.fn()} onOpenAssetPicker={vi.fn()} onAssetApplied={vi.fn()} convergenceMap={new Map()} /></FeedbackProvider>)
    fireEvent.click(screen.getByRole('button', { name: '展开/折叠' }))
    expect(select).toHaveBeenCalledWith('line')
  })
  it('updates the raw alias character node when the selected speaker uses a project id', () => {
    localStorage.setItem(CHARACTER_KEY, JSON.stringify([{ id: 'legacy-yuki', name: '雪', expressions: [{ id: 'normal', label: '平静', url: '/normal.png' }, { id: 'smile', label: '微笑', url: '/smile.png' }], defaultExpression: 'normal' }]))
    const nodes: Node[] = [
      { id: 'char', type: 'character', position: { x: 0, y: 0 }, data: { characterId: 'legacy-yuki', expression: 'normal', position: 'left', action: 'show', sceneGroupId: 's', sceneCode: '1-1' } },
      { id: 'line', type: 'dialogue', position: { x: 0, y: 100 }, data: { role: 'legacy-yuki', text: '早上好。', sceneGroupId: 's', sceneCode: '1-1' } },
    ]
    const update = vi.fn()
    render(<FeedbackProvider><ShotCardEditor nodes={nodes} edges={[{ id: 'e', source: 'char', target: 'line' }]} selectedSceneId="s" selectedCardId="line" autoEditCardId="line" onConsumeAutoEdit={vi.fn()} onSelectCard={vi.fn()} onUpdateGraph={update} onRequestAI={vi.fn()} onSetSceneExit={vi.fn()} scenes={[]} onCreateBranch={vi.fn()} onNavigateToScene={vi.fn()} onOpenAssetPicker={vi.fn()} onAssetApplied={vi.fn()} convergenceMap={new Map()} projectCharacters={[{ id: 'db-yuki', name: '雪', description: null, color: '#fff', defaultSprite: '/normal.png' }]} /></FeedbackProvider>)
    const positions = screen.getAllByRole('combobox').filter(e => (e as HTMLSelectElement).value === 'left')
    fireEvent.change(positions.at(-1)!, { target: { value: 'right' } })
    const next = update.mock.calls.at(-1)![0] as Node[]
    expect(next.find(n => n.id === 'char')!.data.position).toBe('right')
  })
})
