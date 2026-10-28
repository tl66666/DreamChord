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

    expect(screen.getByRole('heading', { name: '音乐与音效' })).toBeInTheDocument()
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

  it('matches individual soundtrack mood tags and reads the official duration', () => {
    render(<MusicLibrary assets={[{ ...assets[0], metadata: JSON.stringify({ audioLibrary: { mood: '温柔 / 黄昏', style: '视觉小说原声' }, officialSoundtrack: { durationSeconds: 112 } }) }]} loading={false} onUpload={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('音乐情绪'), { target: { value: '温柔' } })
    expect(screen.getByText('雨夜手记.wav')).toBeInTheDocument()
    expect(screen.getByText('01:52')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('音乐风格'), { target: { value: '视觉小说原声' } })
    expect(screen.getByText('雨夜手记.wav')).toBeInTheDocument()
  })

  it('preserves the player and editor when deletion is cancelled', async () => {
    const onDelete = vi.fn().mockResolvedValue(false)
    render(<MusicLibrary assets={assets} loading={false} onUpload={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: '试听雨夜手记.wav' }))
    fireEvent.click(screen.getByRole('button', { name: '编辑雨夜手记.wav' }))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalled())
    expect(screen.getByLabelText('音乐库持续播放器')).toBeInTheDocument()
    expect(screen.getByLabelText('素材名称')).toBeInTheDocument()
  })
})
