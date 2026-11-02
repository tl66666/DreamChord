// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardEditor } from './CardEditor'
import type { ShotCard } from './sceneGraph'

const card: ShotCard = {
  id: 'line-1', sceneId: 'scene-1', sceneGroupId: 'scene-1', sceneCode: '1-1', nodeIds: ['line-1'],
  type: 'dialogue', lensType: 'dialogue', background: '', characters: [], speaker: '旁白',
  speakerExpression: 'normal', speakerPosition: 'left', autoStageSpeaker: false, text: '雨落在窗沿。',
}

describe('card audio direction', () => {
  afterEach(cleanup)

  it('edits music volume down to zero and fades without losing the track or other channels', () => {
    const onUpdate = vi.fn()
    const audio = { bgm: { action: 'play' as const, url: '/theme.ogg', volume: .6, fadeInMs: 500, fadeOutMs: 900 }, voice: { url: '/voice.wav' }, sfx: [{ url: '/bell.wav' }] }
    render(<CardEditor card={{ ...card, audio }} characters={[]} libraryScenes={[]} storyTemplates={[]} allScenes={[]} allEdges={[]} convergenceMap={new Map()} onUpdate={onUpdate} onSetChoiceTarget={vi.fn()} onCreateBranch={vi.fn()} onNavigateToScene={vi.fn()} onRequestAI={vi.fn()} onOpenAssetPicker={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('背景音乐音量'), { target: { value: '0' } })
    expect(onUpdate).toHaveBeenLastCalledWith({ audio: { ...audio, bgm: { ...audio.bgm, volume: 0 } } })
    fireEvent.change(screen.getByLabelText('音乐淡出时长（秒）'), { target: { value: '2' } })
    expect(onUpdate).toHaveBeenLastCalledWith({ audio: { ...audio, bgm: { ...audio.bgm, fadeOutMs: 2000 } } })
  })

  it('opens the project asset picker for each audio channel on the current shot', () => {
    const onOpenAssetPicker = vi.fn()
    render(
      <CardEditor
        card={card}
        characters={[]}
        libraryScenes={[]}
        storyTemplates={[]}
        allScenes={[]}
        allEdges={[]}
        convergenceMap={new Map()}
        onUpdate={vi.fn()}
        onSetChoiceTarget={vi.fn()}
        onCreateBranch={vi.fn()}
        onNavigateToScene={vi.fn()}
        onRequestAI={vi.fn()}
        onOpenAssetPicker={onOpenAssetPicker}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '从项目素材选择背景音乐' }))
    fireEvent.click(screen.getByRole('button', { name: '从项目素材选择音效' }))
    fireEvent.click(screen.getByRole('button', { name: '从项目素材选择配音' }))

    expect(onOpenAssetPicker).toHaveBeenNthCalledWith(1, 'line-1', 'bgm')
    expect(onOpenAssetPicker).toHaveBeenNthCalledWith(2, 'line-1', 'sfx')
    expect(onOpenAssetPicker).toHaveBeenNthCalledWith(3, 'line-1', 'voice')
  })
})
