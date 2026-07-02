/**
 * ErrorBoundary.tsx — 全局错误边界
 *
 * 捕获子组件渲染异常，防止整个应用白屏崩溃。
 * 提供错误恢复 UI（刷新页面 / 返回首页）。
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] 捕获到未处理异常:', error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleHome = (): void => {
    window.location.href = '/'
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-dream-50 via-white to-chord-blue/5 p-4">
          <div className="max-w-md rounded-lg border border-red-200 bg-white/90 p-6 text-center shadow-lg">
            <div className="mb-3 text-3xl">⚠️</div>
            <h2 className="mb-2 text-lg font-bold text-dream-800">页面出错了</h2>
            <p className="mb-4 text-sm text-dream-500">
              应用遇到了一个意外错误。您可以尝试刷新页面或返回首页。
            </p>
            {this.state.error && (
              <details className="mb-4 rounded bg-dream-50 p-2 text-left text-xs text-dream-400">
                <summary className="cursor-pointer font-medium">错误详情</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex justify-center gap-2">
              <button
                onClick={this.handleReload}
                className="rounded-md bg-dream-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-dream-600"
              >
                刷新页面
              </button>
              <button
                onClick={this.handleHome}
                className="rounded-md border border-dream-200 px-4 py-2 text-sm font-medium text-dream-600 transition hover:bg-dream-50"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
