// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaintWorldPanel } from './PaintWorldPanel'

afterEach(cleanup)

describe('paint world reading panel', () => {
  it('opens an accessible reader and distinguishes existing people from future appearances', () => {
    render(<PaintWorldPanel onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: '镇子与人物' })
    expect(within(dialog).getByRole('tab', { name: '人物' }).getAttribute('aria-selected')).toBe('true')
    for (const name of ['刘济安', '沈芸', '陶宁', '周岑']) expect(within(dialog).getByRole('heading', { name })).toBeTruthy()
    expect(within(dialog).getAllByText('后续登场')).toHaveLength(2)
    expect(within(dialog).getByText(/她负责进货与看店/)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: '关闭镇子与人物' })).toBe(document.activeElement)
  })

  it('switches to the town and complete everyday stories without presenting new lore as old text', () => {
    render(<PaintWorldPanel onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: '镇子' }))
    expect(screen.getByRole('heading', { name: '栖川镇' })).toBeTruthy()
    expect(screen.getByText(/镇名是本次补充设定/)).toBeTruthy()
    expect(screen.getAllByText('正文已呈现').length).toBeGreaterThan(0)
    expect(screen.getAllByText('新增补充').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: '生活片段' }))
    expect(screen.getByRole('heading', { name: '柜台下的半箱肥皂' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '钥匙没有算进屋顶钱' })).toBeTruthy()
    expect(screen.getByText('补充短篇 · 排练前的镇上日常，不替代主线')).toBeTruthy()
    expect(screen.getByText(/“给你留着。别到时候还来替我数肥皂。”/)).toBeTruthy()
    expect(screen.getByText(/修的凳子傍晚要交/)).toBeTruthy()
    expect(screen.queryByText(/人家的衣服也要赶着穿/)).toBeNull()
  })

  it('closes by its button or Escape and restores the opening focus', () => {
    const onClose = vi.fn()
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const { unmount } = render(<PaintWorldPanel onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '关闭镇子与人物' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('supports arrow-key tabs and keeps keyboard focus inside the reader', () => {
    render(<PaintWorldPanel onClose={() => {}} />)
    const people = screen.getByRole('tab', { name: '人物' })
    people.focus()
    fireEvent.keyDown(people, { key: 'ArrowRight' })
    const town = screen.getByRole('tab', { name: '镇子' })
    expect(town.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(town)
    const close = screen.getByRole('button', { name: '关闭镇子与人物' })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('tabpanel'))
    fireEvent.keyDown(screen.getByRole('tabpanel'), { key: 'Tab' })
    expect(document.activeElement).toBe(close)
  })

  it('does not let reading clicks advance the player beneath it', () => {
    const advance = vi.fn()
    const onClose = vi.fn()
    render(<div onClick={advance}><PaintWorldPanel onClose={onClose} /></div>)
    fireEvent.click(screen.getByRole('heading', { name: '刘济安' }))
    expect(advance).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(advance).not.toHaveBeenCalled()
  })
})
