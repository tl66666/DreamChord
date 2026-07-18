// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import SettingsPage from './SettingsPage'

describe('SettingsPage', () => {
  afterEach(() => localStorage.clear())

  it('returns to the originating Agent workspace after model configuration', () => {
    render(<MemoryRouter initialEntries={['/settings?returnTo=%2Feditor%2Fsakura-story']}><SettingsPage /></MemoryRouter>)

    expect(screen.getByRole('link', { name: '返回创作 Agent' }).getAttribute('href')).toBe('/editor/sakura-story')
  })
})
