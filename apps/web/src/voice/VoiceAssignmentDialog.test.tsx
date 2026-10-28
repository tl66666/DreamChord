// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDetail, VoiceProfile } from '../api/client'
import VoiceAssignmentDialog from './VoiceAssignmentDialog'
import VoicePickerDialog from './VoicePickerDialog'
const bind = vi.hoisted(() => vi.fn())
vi.mock('../api/client', async (original) => ({ ...await original<typeof import('../api/client')>(), bindCharacterVoice: bind }))
const profile = { id: 'voice-new', name: '清亮少女', language: 'zh', status: 'active', tags: '[]', references: [{ id: 'ref', language: 'zh', status: 'active', asset: { url: '/reference.wav' } }], bindings: [] } as unknown as VoiceProfile
const project = { id: 'story', title: '放学后的约定', characters: [{ id: 'yuki', name: '雪' }] } as ProjectDetail
describe('audition and assignment workflow', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })
  it('saves the selected voice to one role and offers a direct return to its editor', async () => {
    const saved = vi.fn(), edit = vi.fn()
    bind.mockResolvedValue({ id: 'binding', project: { id: 'story', title: project.title }, character: { id: 'yuki', name: '雪' } })
    render(<VoiceAssignmentDialog profile={profile} profiles={[profile]} projects={[project]} onSaved={saved} onEditProject={edit} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '保存角色音色' })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('分配给雪'))
    fireEvent.click(screen.getByRole('button', { name: '保存角色音色' }))
    await screen.findByText('已保存。角色后续台词将沿用这个音色。')
    expect(bind).toHaveBeenCalledWith('voice-new', { projectId: 'story', characterId: 'yuki' })
    expect(saved).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('去编辑器生成配音'))
    expect(edit).toHaveBeenCalledWith('story')
  })
  it('keeps assignment unchanged when the server rejects a save', async () => {
    const saved = vi.fn()
    bind.mockRejectedValue({ response: { data: { error: '保存失败，请重试' } } })
    render(<VoiceAssignmentDialog profile={profile} profiles={[profile]} projects={[project]} onSaved={saved} onEditProject={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('分配给雪'))
    fireEvent.click(screen.getByText('保存角色音色'))
    await screen.findByRole('alert')
    expect(saved).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '保存角色音色' })).toBeEnabled()
  })
  it('lets authors listen in the editor before committing a different voice', async () => {
    const choose = vi.fn().mockResolvedValue(undefined)
    render(<VoicePickerDialog profiles={[profile]} characterName="雪" onChoose={choose} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('试听清亮少女'))
    expect(screen.getByLabelText('选音色试听播放器')).toHaveAttribute('src', '/reference.wav')
    expect(choose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('分配给雪'))
    await waitFor(() => expect(choose).toHaveBeenCalledWith(profile))
  })
})
