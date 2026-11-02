// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import SettingsPage from './SettingsPage'

describe('SettingsPage', () => {
  afterEach(() => { cleanup(); localStorage.clear() })

  it('accepts a platform model ID directly and explains incomplete configuration before saving', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    fireEvent.click(screen.getAllByRole('radio')[0]!)
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))
    expect(screen.getByRole('alert').textContent).toMatch(/API Key/)
    fireEvent.change(screen.getAllByLabelText('API Key')[0]!, { target: { value: 'test-key' } })
    fireEvent.change(screen.getAllByLabelText('模型 ID')[0]!, { target: { value: 'org/my-new-model' } })
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))
    expect(localStorage.getItem('dreamchord_ai_configs_v2')).toContain('org/my-new-model')
    expect(screen.getByRole('button', { name: '已保存' })).toBeTruthy()
  })

  it('returns to the originating Agent workspace after model configuration', () => {
    render(<MemoryRouter initialEntries={['/settings?returnTo=%2Feditor%2Fsakura-story']}><SettingsPage /></MemoryRouter>)

    expect(screen.getByRole('link', { name: '返回编辑器' }).getAttribute('href')).toBe('/editor/sakura-story')
  })
})
