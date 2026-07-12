// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '../components/FeedbackProvider'
import AssetProcessingSheet from './AssetProcessingSheet'

const api = vi.hoisted(() => ({ process: vi.fn(), accept: vi.fn(), reject: vi.fn() }))
vi.mock('../api/client', () => ({
  processAsset: (...args: unknown[]) => api.process(...args),
  acceptAssetVariant: (...args: unknown[]) => api.accept(...args),
  rejectAssetVariant: (...args: unknown[]) => api.reject(...args),
}))

const asset = { id: 'asset', name: '雪原图', type: 'CG', url: '/uploads/source.png', createdAt: '2026-07-12', width: 800, height: 1200, variants: [] }
const variant = { id: 'variant', assetId: 'asset', kind: 'sprite', status: 'proposed', url: '/uploads/sprite.png', mimeType: 'image/png', width: 1024, height: 1536, metadata: '{}', createdAt: '2026-07-12' }

describe('asset processing sheet', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })
  it('processes, previews, and binds a sprite only after explicit acceptance', async () => {
    const accepted = { variant: { ...variant, status: 'accepted' }, character: { id: 'character', name: '雪' } }
    const onAccepted = vi.fn()
    api.process.mockResolvedValue(variant)
    api.accept.mockResolvedValue(accepted)
    render(<FeedbackProvider><AssetProcessingSheet asset={asset} onClose={vi.fn()} onAccepted={onAccepted} /></FeedbackProvider>)
    fireEvent.click(screen.getByRole('button', { name: '立绘' }))
    fireEvent.change(screen.getByLabelText('白底阈值'), { target: { value: '238' } })
    fireEvent.click(screen.getByRole('button', { name: '生成预览' }))
    expect(await screen.findByAltText('处理结果')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '雪' } })
    fireEvent.change(screen.getByLabelText('表情名称'), { target: { value: 'normal' } })
    fireEvent.click(screen.getByRole('button', { name: '接受并绑定' }))
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith('variant', expect.objectContaining({ purpose: 'sprite', characterName: '雪', expressionName: 'normal' })))
    expect(onAccepted).toHaveBeenCalledWith(accepted)
  })
})
