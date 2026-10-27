// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MusicLibrary from './MusicLibrary'

describe('MusicLibrary', () => {
  afterEach(cleanup)

  const assets = [
    {
      id: 'rain', name: '雨夜手记.wav', type: 'BGM', url: '/uploads/rain.wav', createdAt: '2026-10-27',
      metadata: JSON.stringify({ audioLibrary: { mood: '忧郁', style: '氛围', scene: '雨夜独白', loop: true, license: '原创' }, starterMusic: { durationSeconds: 20 } }),
    },
    {
      id: 'bell', name: '放学铃.wav', type: 'SFX', url: '/uploads/bell.wav', createdAt: '2026-10-27',
      metadata: JSON.stringify({ audioLibrary: { mood: '日常', style: '环境', scene: '校园', loop: false } }),
    },
  ]

  it('filters BGM by story mood and exposes a persistent preview player', () => {
    render(<MusicLibrary assets={assets} loading={false} onUpload={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '音乐库' })).toBeInTheDocument()
    expect(screen.getByText('雨夜手记.wav')).toBeInTheDocument()
    expect(screen.getByText('00:20')).toBeInTheDocument()
    expect(screen.queryByText('放学铃.wav')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '试听雨夜手记.wav' }))
    expect(screen.getByLabelText('音乐库持续播放器')).toHaveAttribute('src', '/uploads/rain.wav')
    expect(screen.getByTestId('music-player-tray')).toHaveTextContent('雨夜手记.wav')
  })

  it('switches to sound effects and saves galgame-specific metadata', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ ...assets[1], name: '旧校舍铃声.wav' })
    render(<MusicLibrary assets={assets} loading={false} onUpload={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '音效' }))
    expect(screen.getByText('放学铃.wav')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '编辑放学铃.wav' }))
    fireEvent.change(screen.getByLabelText('素材名称'), { target: { value: '旧校舍铃声.wav' } })
    fireEvent.change(screen.getByLabelText('适用场景'), { target: { value: '悬疑调查' } })
    fireEvent.click(screen.getByRole('button', { name: '保存音乐信息' }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('bell', expect.objectContaining({
      name: '旧校舍铃声.wav',
      audioLibrary: expect.objectContaining({ scene: '悬疑调查', loop: false }),
    })))
  })
})
