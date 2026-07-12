// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '../components/FeedbackProvider'
import AssetProcessingSheet from './AssetProcessingSheet'

const api = vi.hoisted(() => ({ inspect: vi.fn(), process: vi.fn(), accept: vi.fn(), reject: vi.fn() }))
vi.mock('../api/client', () => ({
  inspectAsset: (...args: unknown[]) => api.inspect(...args),
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
    api.inspect.mockResolvedValue({ analysis: { background: 'flat-light', recommendedPurpose: 'sprite', recommendedRecipe: { removeWhite: true, trim: true, whiteThreshold: 245, feather: 8 }, confidence: 0.92, reasons: ['纵向构图适合角色立绘。'], warnings: [] } })
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

  it('applies a flat-light recommendation and explains why', async () => {
    api.inspect.mockResolvedValue({ analysis: { background: 'flat-light', recommendedPurpose: 'sprite', recommendedRecipe: { removeWhite: true, trim: true, whiteThreshold: 242, feather: 6 }, confidence: 0.91, reasons: ['边缘接近均匀浅色。'], warnings: [] } })
    render(<FeedbackProvider><AssetProcessingSheet asset={asset} onClose={vi.fn()} onAccepted={vi.fn()} /></FeedbackProvider>)
    expect(await screen.findByText('推荐：角色立绘')).toBeTruthy()
    expect(screen.getByText('边缘接近均匀浅色。')).toBeTruthy()
    expect((screen.getByLabelText('去除白色背景') as HTMLInputElement).checked).toBe(true)
  })

  it('does not enable local cutout for a complex background', async () => {
    api.inspect.mockResolvedValue({ analysis: { background: 'complex', recommendedPurpose: 'cg', recommendedRecipe: { removeWhite: false, trim: false, whiteThreshold: 245, feather: 8 }, confidence: 0.62, reasons: ['图片边缘颜色复杂。'], warnings: ['复杂背景无法可靠自动抠图，请上传透明 PNG 或纯色底原图。'] } })
    render(<FeedbackProvider><AssetProcessingSheet asset={asset} onClose={vi.fn()} onAccepted={vi.fn()} /></FeedbackProvider>)
    expect(await screen.findByText('推荐：剧情 CG')).toBeTruthy()
    expect(screen.getByText(/复杂背景无法可靠自动抠图/)).toBeTruthy()
    expect(screen.queryByLabelText('去除白色背景')).toBeNull()
  })
})
