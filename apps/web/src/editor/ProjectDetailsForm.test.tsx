// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProjectDetailsForm from './ProjectDetailsForm'
vi.mock('../api/client', () => ({ uploadAsset: vi.fn() }))
describe('story details form', () => {
  afterEach(cleanup)
  const project = { id: 'story', title: '雾港来信', cover: '/assets/covers/story-draft.webp' }
  it('submits a chosen built-in cover and independent defaults, waiting for actual save', async () => {
    const save = vi.fn(async () => {})
    render(<ProjectDetailsForm project={project} onSave={save} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '使用消失的终页封面' }))
    fireEvent.change(screen.getByLabelText('默认配音语言'), { target: { value: 'ja' } })
    fireEvent.click(screen.getByRole('button', { name: '保存故事设置' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ cover: '/assets/covers/first-thread.webp', defaultVoiceLocale: 'ja', defaultSubtitleLocale: 'zh' })))
  })
  it('keeps edits and offers retry when saving fails', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('服务暂时不可用')).mockResolvedValueOnce(undefined)
    render(<ProjectDetailsForm project={project} onSave={save} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('故事名称'), { target: { value: '新的故事名' } })
    fireEvent.click(screen.getByRole('button', { name: '保存故事设置' }))
    expect((await screen.findByRole('alert')).textContent).toContain('服务暂时不可用')
    expect((screen.getByLabelText('故事名称') as HTMLInputElement).value).toBe('新的故事名')
    fireEvent.click(screen.getByRole('button', { name: '保存故事设置' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  })
})
