// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FeedbackProvider } from '../components/FeedbackProvider'
import WorkbenchPanel from './WorkbenchPanel'

describe('WorkbenchPanel tabs', () => {
  afterEach(cleanup)

  it('renders the story, character, and scene workspaces', () => {
    render(<FeedbackProvider><WorkbenchPanel onSave={() => undefined} /></FeedbackProvider>)
    expect(screen.getByRole('heading', { name: '故事工作台' })).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: '角色' })[0])
    expect(screen.getByText('雪')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '场景' }))
    expect(screen.getByText('樱花坡道')).toBeTruthy()
  })
})
