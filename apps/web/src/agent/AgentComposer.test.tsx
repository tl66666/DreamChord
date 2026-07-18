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

  it('starts a local playable-scene task without requiring an API key', () => {
    const onPromptChange = vi.fn()
    const onScopeChange = vi.fn()
    const onOpenSettings = vi.fn()
    render(<AgentComposer
      prompt="" scope="chapter" disabled={false} hasProvider={false} hasChapter
      onPromptChange={onPromptChange} onScopeChange={onScopeChange} onRun={vi.fn()} onHealth={vi.fn()} onOpenSettings={onOpenSettings}
    />)

    fireEvent.click(screen.getByRole('button', { name: '生成试玩场景' }))
    expect(onPromptChange).toHaveBeenCalledWith(expect.stringContaining('最近一份续写草稿'))
    expect(onScopeChange).toHaveBeenCalledWith('chapter')
    expect(onOpenSettings).not.toHaveBeenCalled()
  })

  it('lets a chapter author choose between reusing assets and requesting image prompts', () => {
    const onMaterialModeChange = vi.fn()
    render(<AgentComposer
      prompt="搭建下一段剧情" scope="chapter" disabled={false} hasProvider={false} hasChapter
      materialMode="reuse" onMaterialModeChange={onMaterialModeChange}
      onPromptChange={vi.fn()} onScopeChange={vi.fn()} onRun={vi.fn()} onHealth={vi.fn()} onOpenSettings={vi.fn()}
    />)

    const materialMode = screen.getByLabelText('素材策略')
    expect(materialMode).toHaveValue('reuse')
    fireEvent.change(materialMode, { target: { value: 'prompts' } })
    expect(onMaterialModeChange).toHaveBeenCalledWith('prompts')
  })

  it('keeps the compact composer short while retaining the playable-scene command', () => {
    render(<AgentComposer
      prompt="" scope="chapter" disabled={false} hasProvider={false} hasChapter compact
      onPromptChange={vi.fn()} onScopeChange={vi.fn()} onRun={vi.fn()} onHealth={vi.fn()} onOpenSettings={vi.fn()}
    />)

    expect(screen.getByLabelText('创作任务')).toHaveAttribute('rows', '2')
    expect(screen.getByRole('button', { name: '生成试玩场景' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '润色当前' })).not.toBeInTheDocument()
  })

  it('binds the compact continuation command to the selected scene', () => {
    const onPromptChange = vi.fn()
    const onScopeChange = vi.fn()
    render(<AgentComposer
      prompt="" scope="chapter" disabled={false} hasProvider hasChapter compact hasSelectedScene
      onPromptChange={onPromptChange} onScopeChange={onScopeChange} onRun={vi.fn()} onHealth={vi.fn()} onOpenSettings={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('button', { name: '续写已选场景' }))
    expect(onPromptChange).toHaveBeenCalledWith(expect.stringContaining('续写'))
    expect(onScopeChange).toHaveBeenCalledWith('scene')
  })

  it('offers a dedicated command to convert pasted story prose into workbench cards', () => {
    const onConvertText = vi.fn()
    render(<AgentComposer
      prompt="林宇：\n“雨停后就出发。”\n\n林晚把车票攥得更紧。" scope="chapter" disabled={false} hasProvider hasChapter compact
      onPromptChange={vi.fn()} onScopeChange={vi.fn()} onRun={vi.fn()} onConvertText={onConvertText} onHealth={vi.fn()} onOpenSettings={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('button', { name: '将正文转为场景' }))
    expect(onConvertText).toHaveBeenCalledOnce()
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
