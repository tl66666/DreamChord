// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AgentComposer from './AgentComposer'

describe('AgentComposer local mode', () => {
  afterEach(cleanup)

  it('keeps the local assistant runnable without a configured provider', () => {
    const onRun = vi.fn()
    render(<AgentComposer
      prompt="概括这个项目" scope="project" disabled={false} hasProvider={false}
      onPromptChange={vi.fn()} onScopeChange={vi.fn()} onRun={onRun} onHealth={vi.fn()} onOpenSettings={vi.fn()}
    />)

    const button = screen.getByRole('button', { name: '发送给 Agent' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(onRun).toHaveBeenCalledOnce()
  })

  it('offers model settings for generative writing shortcuts without creating a failed task', () => {
    const onOpenSettings = vi.fn()
    render(<AgentComposer
      prompt="" scope="project" disabled={false} hasProvider={false}
      onPromptChange={vi.fn()} onScopeChange={vi.fn()} onRun={vi.fn()} onHealth={vi.fn()} onOpenSettings={onOpenSettings}
    />)

    fireEvent.click(screen.getByRole('button', { name: '续写场景' }))
    expect(onOpenSettings).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '前往模型设置' })).toBeInTheDocument()
  })

  it('keeps only project scope available without a bound chapter', () => {
    render(<AgentComposer
      prompt="检查项目" scope="project" disabled={false} hasProvider hasChapter={false}
      onPromptChange={vi.fn()} onScopeChange={vi.fn()} onRun={vi.fn()} onHealth={vi.fn()} onOpenSettings={vi.fn()}
    />)

    expect(screen.getByRole('button', { name: '当前镜头' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '当前场景' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '当前章节' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '全项目' })).toBeEnabled()
  })

  it('sends on Enter while keeping Shift+Enter for a newline', () => {
    const onRun = vi.fn()
    render(<AgentComposer
      prompt="润色这句台词" scope="card" disabled={false} hasProvider
      onPromptChange={vi.fn()} onScopeChange={vi.fn()} onRun={onRun} onHealth={vi.fn()} onOpenSettings={vi.fn()}
    />)

    const textarea = screen.getByLabelText('创作任务')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    expect(onRun).toHaveBeenCalledOnce()

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true })
    expect(onRun).toHaveBeenCalledOnce()
  })
})
