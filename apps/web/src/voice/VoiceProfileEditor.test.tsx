// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceProfile } from '../api/client'
import VoiceProfileEditor from './VoiceProfileEditor'

const api = vi.hoisted(() => ({ update: vi.fn(), remove: vi.fn() }))
vi.mock('../api/client', async (original) => ({ ...await original<typeof import('../api/client')>(), updateVoiceProfile: api.update, deleteVoiceProfile: api.remove }))
const profile = { id: 'voice', name: '雪', description: '清亮', language: 'zh', genderTone: '女声', ageTone: '少女', defaultEmotion: '自然', defaultSpeed: 1, status: 'active', authorizationNote: '原创合成音色', references: [], bindings: [] } as unknown as VoiceProfile
describe('voice profile settings', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })
  it('saves changed metadata and returns the server profile to the catalog', async () => {
    const saved = { ...profile, name: '雪 · 新版' }
    api.update.mockResolvedValue(saved)
    const onSaved = vi.fn(), onClose = vi.fn()
    render(<VoiceProfileEditor profile={profile} onSaved={onSaved} onDeleted={vi.fn()} onClose={onClose} />)
    expect(screen.getByLabelText('编辑音色名称')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('编辑音色名称'), { target: { value: saved.name } })
    fireEvent.click(screen.getByText('保存设置'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    expect(api.update).toHaveBeenCalledWith('voice', expect.objectContaining({ name: saved.name }))
    expect(onClose).toHaveBeenCalled()
  })
  it('keeps a referenced profile visible when the server rejects deletion', async () => {
    api.remove.mockRejectedValue({ response: { data: { error: '已有配音记录，请先停用。' } } })
    const onDeleted = vi.fn(), onClose = vi.fn()
    render(<VoiceProfileEditor profile={profile} onSaved={vi.fn()} onDeleted={onDeleted} onClose={onClose} />)
    fireEvent.click(screen.getByText('删除音色档案'))
    expect(api.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('确认删除档案'))
    expect(await screen.findByRole('alert')).toHaveTextContent('已有配音记录，请先停用。')
    expect(onDeleted).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
