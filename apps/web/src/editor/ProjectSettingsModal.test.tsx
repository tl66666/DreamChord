// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProjectSettingsModal from './ProjectSettingsModal'
const confirm = vi.hoisted(() => vi.fn())
vi.mock('../components/FeedbackProvider', () => ({ useConfirm: () => confirm }))
vi.mock('../api/client', () => ({ getStoryBible: vi.fn(), updateStoryBible: vi.fn(), uploadAsset: vi.fn() }))
describe('story settings dismissal', () => {
  afterEach(() => { cleanup(); vi.resetAllMocks() })
  it('keeps dirty changes when abandoning is cancelled, and closes only after confirmation', async () => {
    const close = vi.fn()
    render(<ProjectSettingsModal project={{ id: 'story', title: '来信' }} onClose={close} onUpdate={async () => {}} />)
    fireEvent.change(screen.getByLabelText('故事名称'), { target: { value: '新来信' } })
    confirm.mockResolvedValueOnce(false)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    expect(close).not.toHaveBeenCalled()
    expect((screen.getByLabelText('故事名称') as HTMLInputElement).value).toBe('新来信')
    confirm.mockResolvedValueOnce(true)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  })
  it('prevents Escape or a second save while the actual server save is pending', async () => {
    const close = vi.fn(), save = vi.fn(() => new Promise<void>(() => {}))
    render(<ProjectSettingsModal project={{ id: 'story', title: '来信' }} onClose={close} onUpdate={save} />)
    fireEvent.click(screen.getByRole('button', { name: '保存故事设置' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(close).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: '正在保存…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(save).toHaveBeenCalledOnce()
  })
})
