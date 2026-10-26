// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LibraryCharacter } from '../lib/libraryData'
import CharacterGallery from './CharacterGallery'

const characters: LibraryCharacter[] = [
  {
    id: 'yuki', name: '雪', role: '主角', description: '能看见故事节点的女高中生。', biography: '只有详情里能看见的人物小传。',
    outline: '从迷茫走向承担。', usage: '对话和分支剧情', conflicts: ['她想修复世界，却害怕再次删掉某个人。'],
    color: '#8b5cf6', defaultExpression: 'normal', updatedAt: '2026-10-26',
    expressions: [{ id: 'normal', label: '普通', url: '/yuki.png' }, { id: 'smile', label: '微笑', url: '/yuki-smile.png' }],
  },
  {
    id: 'ren', name: '影', role: '关键角色', description: '来自旧版本世界的残影。', biography: '影的人物小传。',
    outline: '把选择权还给雪。', usage: '悬疑推进', conflicts: ['想靠近却总被误解。'], color: '#334155',
    defaultExpression: 'normal', updatedAt: '2026-10-26', expressions: [{ id: 'normal', label: '普通', url: '/ren.png' }],
  },
]

describe('CharacterGallery', () => {
  afterEach(cleanup)

  it('shows visual cards and switches full, bust, and stage framing', () => {
    render(<CharacterGallery characters={characters} selectedExpression={{}} onSelectExpression={vi.fn()} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onReset={vi.fn()} />)

    expect(screen.getByTestId('character-gallery')).toHaveClass('md:grid-cols-2', '2xl:grid-cols-3')
    expect(screen.getAllByTestId(/character-card-/)).toHaveLength(2)
    const preview = screen.getByTestId('character-preview-yuki')
    expect(preview).toHaveClass('aspect-[4/5]')
    expect(preview).toHaveAttribute('data-preview-mode', 'full')

    const modes = screen.getByRole('group', { name: '雪立绘预览模式' })
    fireEvent.click(within(modes).getByRole('button', { name: '半身' }))
    expect(preview).toHaveAttribute('data-preview-mode', 'bust')
    expect(within(preview).getByTestId('stage-character-yuki')).toHaveAttribute('data-framing', 'bust')
    fireEvent.click(within(modes).getByRole('button', { name: '舞台' }))
    expect(preview).toHaveAttribute('data-preview-mode', 'stage')
    expect(within(preview).getByText('台词安全区')).toBeInTheDocument()
  })

  it('keeps dossiers out of cards and opens them in an accessible detail panel', () => {
    render(<CharacterGallery characters={characters} selectedExpression={{}} onSelectExpression={vi.fn()} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onReset={vi.fn()} />)

    const card = screen.getByTestId('character-card-yuki')
    expect(within(card).queryByText('只有详情里能看见的人物小传。')).not.toBeInTheDocument()
    expect(within(card).getByText('2 个表情')).toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: /查看雪的完整设定/ }))

    const dialog = screen.getByRole('dialog', { name: '雪 · 角色详情' })
    expect(within(dialog).getByText('只有详情里能看见的人物小传。')).toBeInTheDocument()
    expect(within(dialog).getByText('从迷茫走向承担。')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edits and deletes from the detail panel, closing after deletion', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<CharacterGallery characters={characters} selectedExpression={{}} onSelectExpression={vi.fn()} onCreate={vi.fn()} onEdit={onEdit} onDelete={onDelete} onReset={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /查看影的完整设定/ }))
    const dialog = screen.getByRole('dialog', { name: '影 · 角色详情' })
    fireEvent.click(within(dialog).getByRole('button', { name: '编辑角色' }))
    expect(onEdit).toHaveBeenCalledWith(characters[1])
    fireEvent.click(screen.getByRole('button', { name: /查看影的完整设定/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: '影 · 角色详情' })).getByRole('button', { name: '删除角色' }))
    expect(onDelete).toHaveBeenCalledWith('ren')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
