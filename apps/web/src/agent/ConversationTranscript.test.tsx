// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConversationTranscript from './ConversationTranscript'

const conversation = { id: 'conversation', title: '新对话', scope: 'chapter', chapterId: 'chapter', isPinned: false, summary: '', createdAt: '', updatedAt: '' }
const messages = [{ id: 'message', role: 'assistant', content: '林宇：\n“我一直在等你回来。”\n\n林晚没有立刻回答，只是握紧了画册。', metadata: {}, createdAt: '2026-07-17T00:00:00.000Z' }]

describe('ConversationTranscript', () => {
  afterEach(cleanup)
  it('follows the newest message when a conversation is opened', async () => {
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo })
    render(<ConversationTranscript conversation={conversation} messages={messages} loading={false} hasMore={false} onLoadMore={vi.fn()} onDraftAction={vi.fn()}><div>composer</div></ConversationTranscript>)

    const scroller = screen.getByLabelText('对话内容').querySelector('.overflow-y-auto') as HTMLDivElement
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 900 })

    await waitFor(() => expect(scrollTo).toHaveBeenCalled())
  })

  it('keeps the composer bounded so saved drafts remain visible and actionable', () => {
    const { container } = render(<ConversationTranscript conversation={conversation} messages={messages} loading={false} hasMore={false} onLoadMore={vi.fn()} onDraftAction={vi.fn()}><div>composer</div></ConversationTranscript>)

    expect(container.querySelector('section[aria-label="对话内容"]')).toHaveClass('flex-1')
    expect(container.querySelector('section[aria-label="对话内容"] > div:last-child')).toHaveClass('max-h-[48%]')
  })

  it('offers a workbench action for a saved assistant continuation', () => {
    const onDraftAction = vi.fn()
    render(<ConversationTranscript conversation={conversation} messages={messages} loading={false} hasMore={false} onLoadMore={vi.fn()} onDraftAction={onDraftAction}><div>composer</div></ConversationTranscript>)

    fireEvent.click(screen.getByRole('button', { name: '生成工作台场景' }))

    expect(onDraftAction).toHaveBeenCalledWith(expect.objectContaining({ scope: 'chapter', draft: messages[0].content }))
  })

  it('edits and saves an assistant draft before it is converted to scene cards', () => {
    const onDraftEdit = vi.fn(async () => undefined)
    render(<ConversationTranscript conversation={conversation} messages={messages} loading={false} hasMore={false} onLoadMore={vi.fn()} onDraftAction={vi.fn()} onDraftEdit={onDraftEdit}><div>composer</div></ConversationTranscript>)

    fireEvent.click(screen.getByRole('button', { name: '编辑草稿' }))
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: '林宇：\n“雨停后就出发。”' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))

    expect(onDraftEdit).toHaveBeenCalledWith('message', '林宇：\n“雨停后就出发。”')
  })

  it('does not offer draft actions for a model protocol payload', () => {
    const protocolMessage = [{ ...messages[0], content: '```json\n{"type":"tool_call","tool":"list_project_assets","input":{"reason":"这是很长的协议字段，不是用户可编辑的剧情正文"}}\n```' }]
    render(<ConversationTranscript conversation={conversation} messages={protocolMessage} loading={false} hasMore={false} onLoadMore={vi.fn()} onDraftAction={vi.fn()}><div>composer</div></ConversationTranscript>)

    expect(screen.queryByRole('button', { name: '生成工作台场景' })).toBeNull()
  })
})
