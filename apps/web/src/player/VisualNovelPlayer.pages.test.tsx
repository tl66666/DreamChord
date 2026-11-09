// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { splitReadingPages } from './readingPages'

const mocks = vi.hoisted(() => ({
  getProject: vi.fn(), toast: { error: vi.fn() },
  director: { playScene: vi.fn(), updateMix: vi.fn(), stopTransient: vi.fn(), dispose: vi.fn(), isVoicePlaying: () => false, onVoiceEnded: () => () => {} },
}))
vi.mock('../api/client', () => ({ getProject: mocks.getProject }))
vi.mock('../components/FeedbackProvider', () => ({ useToast: () => mocks.toast }))
vi.mock('./audioDirector', () => ({ createAudioDirector: () => mocks.director }))
vi.mock('../stage/StageCharacters', () => ({ default: () => null }))
vi.mock('framer-motion', () => ({
  motion: { div: (props: React.HTMLAttributes<HTMLDivElement>) => <div className={props.className} onClick={props.onClick}>{props.children}</div> },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))
import VisualNovelPlayer from './VisualNovelPlayer'

const ja = '窓を開けると、朝の風が部屋に入った。机の上には昨日の切符がある。\n切符をポケットに入れ、通りへ出た。戸のところで、彼女が待っていた。\n彼女は僕に気づいて、片手を上げた。もう片方の手には、二枚の時刻表がある。'
const zh = '推开窗，早晨的风吹进屋子。昨天那张入场券还在桌上。\n我把票装进口袋，走上街。她已经站在门边等了很久。\n她朝我挥了挥手，另一只手拿着两张车次表。今天我们还有些事情要商量。'
const project = {
  id: 'book', title: '分页测试', authorId: 'owner', author: { username: 'owner', nickname: null }, characters: [],
  defaultSubtitleLocale: 'ja', defaultVoiceLocale: 'ja', isPublished: true, isPublic: true,
  chapters: [{ id: 'ch', title: '第一章', order: 0, version: 1, nodes: [
    { id: 'db1', nodeId: 'long', type: 'subtitle', positionX: 0, positionY: 0, data: JSON.stringify({ role: '旁白', text: zh, localizations: { ja: { text: ja } }, audio: { bgm: { action: 'play', url: '/music.ogg', volume: .5 } } }) },
    { id: 'db2', nodeId: 'next', type: 'dialogue', positionX: 0, positionY: 100, data: JSON.stringify({ role: '夏禾', text: '我们走吧。', localizations: { ja: { text: '行こう。' } } }) },
  ], edges: [{ id: 'edge', edgeId: 'e', source: 'long', target: 'next', animated: true }] }],
}
const finishTyping = () => act(() => { vi.advanceTimersByTime(12000) })
const nextPage = () => { fireEvent.keyDown(window, { key: 'Enter' }); finishTyping() }
const openPlayer = async () => {
  await act(async () => { render(<MemoryRouter initialEntries={['/play/book']}><Routes><Route path="/play/:projectId" element={<VisualNovelPlayer />} /></Routes></MemoryRouter>) })
  finishTyping()
}

describe('reader pages with real player navigation', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); mocks.getProject.mockResolvedValue(project) })
  afterEach(() => { cleanup(); vi.useRealTimers() })
  it('opens the town archive without advancing the current reading page', async () => {
    mocks.getProject.mockResolvedValue({ ...project, id: 'dreamchord-paint-prologue' })
    await act(async () => { render(<MemoryRouter initialEntries={['/play/dreamchord-paint-prologue']}><Routes><Route path="/play/:projectId" element={<VisualNovelPlayer />} /></Routes></MemoryRouter>) })
    finishTyping()
    const first = splitReadingPages(ja)[0]
    fireEvent.click(screen.getByTitle('镇子与人物'))
    expect(screen.getByRole('dialog', { name: '镇子与人物' })).toBeTruthy()
    nextPage()
    expect(screen.getByText(first)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭镇子与人物' }))
    expect(screen.queryByRole('dialog', { name: '镇子与人物' })).toBeNull()
    expect(screen.getByText(first)).toBeTruthy()
  })
  it('shows every translated page before advancing, records each once, and does not replay the source music', async () => {
    await openPlayer()
    const pages = splitReadingPages(ja)
    expect(pages.length).toBeGreaterThan(1)
    const musicStarts = () => mocks.director.playScene.mock.calls.filter(call => call[0]?.bgm?.action === 'play').length
    const before = musicStarts()
    for (let i = 0; i < pages.length; i++) {
      expect(screen.getByText(pages[i])).toBeTruthy()
      nextPage()
    }
    expect(screen.getByText('行こう。')).toBeTruthy()
    expect(musicStarts()).toBe(before)
    fireEvent.click(screen.getByTitle('历史 (H)'))
    for (const page of pages) expect(screen.getAllByText(page)).toHaveLength(1)
    expect(screen.queryByText(zh)).toBeNull()
    expect(screen.queryByText(ja)).toBeNull()
  })
  it('really resets the reading page after changing subtitle language away and back', async () => {
    await openPlayer()
    const pages = splitReadingPages(ja)
    nextPage()
    expect(screen.getByText(pages[1])).toBeTruthy()
    fireEvent.click(screen.getByTitle('设置'))
    fireEvent.change(screen.getByLabelText('字幕语言'), { target: { value: 'zh' } })
    finishTyping()
    fireEvent.change(screen.getByLabelText('字幕语言'), { target: { value: 'ja' } })
    finishTyping()
    expect(screen.getByText(pages[0])).toBeTruthy()
    expect(screen.queryByText(pages[1])).toBeNull()
    fireEvent.keyDown(screen.getByLabelText('字幕语言'), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '播放设置' })).toBeNull()
  })
  it.each([[3, '第二章'], [4, '第三章']])('credits the book score and identifies the %s chapter release ending', async (count, title) => {
    mocks.getProject.mockResolvedValue({ ...project, id: 'dreamchord-paint-prologue', chapters: Array.from({ length: count as number }, (_, order) => ({ ...project.chapters[0], id: `ch-${order}`, order })) })
    await act(async () => { render(<MemoryRouter initialEntries={['/play/dreamchord-paint-prologue']}><Routes><Route path="/play/:projectId" element={<VisualNovelPlayer />} /></Routes></MemoryRouter>) })
    finishTyping()
    for (let i = 0; i < 30; i++) nextPage()
    expect(screen.getByText(new RegExp(`${title}到这里结束`))).toBeTruthy()
    expect(screen.getByRole('link', { name: '配乐与素材署名' }).getAttribute('href')).toBe('/assets/audio/paint-book/credits.html')
    expect(screen.getByText(/TAM Music Factory/)).toBeTruthy()
  })
})
