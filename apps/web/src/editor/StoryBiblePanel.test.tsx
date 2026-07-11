// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StoryBiblePanel, { type StoryBibleContent } from './StoryBiblePanel'

const empty: StoryBibleContent = {
  worldSummary: '',
  themes: [],
  styleGuide: '',
  timelineRules: '',
  forbiddenElements: [],
  characterNotes: {},
}

describe('StoryBiblePanel', () => {
  it('submits structured story constraints', () => {
    const onSave = vi.fn()
    render(<StoryBiblePanel initialValue={empty} characters={[{ id: 'yuki', name: '雪' }]} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('世界观摘要'), { target: { value: '节点能改写现实。' } })
    fireEvent.change(screen.getByLabelText('叙事主题'), { target: { value: '存在，选择' } })
    fireEvent.change(screen.getByLabelText('雪的角色目标'), { target: { value: '保护同伴' } })
    fireEvent.click(screen.getByRole('button', { name: '保存故事圣经' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      worldSummary: '节点能改写现实。',
      themes: ['存在', '选择'],
      characterNotes: expect.objectContaining({ yuki: expect.objectContaining({ goal: '保护同伴' }) }),
    }))
  })
})
