// @vitest-environment jsdom
import { useEffect } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FeedbackProvider, useToast } from './FeedbackProvider'

afterEach(() => cleanup())

it('keeps notification callbacks stable so a failed page load does not restart when a toast appears', () => {
  const load = vi.fn()
  function Page() {
    const toast = useToast()
    useEffect(load, [toast])
    return <button onClick={() => toast.error('加载失败')}>显示错误</button>
  }
  render(<FeedbackProvider><Page /></FeedbackProvider>)
  expect(load).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByText('显示错误'))
  expect(screen.getByText('加载失败')).toBeTruthy()
  expect(load).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByLabelText('关闭通知'))
  expect(load).toHaveBeenCalledTimes(1)
})
