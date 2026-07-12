/**
 * FeedbackProvider.tsx — 全局 Toast 通知 + Confirm 确认对话框
 *
 * 替换原生 alert() / confirm()，提供统一的、可定制的用户反馈体验。
 * - useToast(): toast.success / toast.error / toast.info
 * - useConfirm(): const ok = await confirm({ title, message, danger })
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  type MouseEvent,
} from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

// ============================================================
// Toast
// ============================================================

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toastConfig: Record<ToastType, { icon: typeof CheckCircle2; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  error: { icon: XCircle, classes: 'border-red-200 bg-red-50 text-red-800' },
  info: { icon: Info, classes: 'border-dream-200 bg-dream-50 text-dream-800' },
}

let toastIdCounter = 0

// ============================================================
// Confirm
// ============================================================

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolver: ((value: boolean) => void) | null
}

// ============================================================
// Provider
// ============================================================

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    message: '',
    resolver: null,
  })

  // --- Toast ---
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastIdCounter
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => dismissToast(id), 3500)
  }, [dismissToast])

  const toast: ToastContextValue = {
    success: (msg) => pushToast('success', msg),
    error: (msg) => pushToast('error', msg),
    info: (msg) => pushToast('info', msg),
  }

  // --- Confirm ---
  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        open: true,
        title: opts.title,
        message: opts.message,
        confirmText: opts.confirmText,
        cancelText: opts.cancelText,
        danger: opts.danger,
        resolver: resolve,
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    confirmState.resolver?.(true)
    setConfirmState({ open: false, message: '', resolver: null })
  }, [confirmState])

  const handleCancel = useCallback(() => {
    confirmState.resolver?.(false)
    setConfirmState({ open: false, message: '', resolver: null })
  }, [confirmState])

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={{ confirm }}>
        {children}

        {/* Toast 容器 */}
        <div className="pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col gap-2">
          {toasts.map((t) => {
            const cfg = toastConfig[t.type]
            const Icon = cfg.icon
            return (
              <div
                key={t.id}
                className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 shadow-md backdrop-blur-sm ${cfg.classes} animate-in slide-in-from-right`}
                style={{ animation: 'slideIn 0.2s ease-out' }}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-sm leading-5">{t.message}</span>
                <button
                  onClick={() => dismissToast(t.id)}
                  className="ml-2 shrink-0 opacity-50 transition hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Confirm 对话框 */}
        {confirmState.open && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={handleCancel}
          >
            <div
              className="mx-4 w-full max-w-sm rounded-xl border border-dream-100 bg-white p-6 shadow-xl"
              onClick={(e: MouseEvent) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                {confirmState.danger ? (
                  <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" />
                ) : (
                  <Info className="mt-0.5 h-6 w-6 shrink-0 text-dream-500" />
                )}
                <div className="flex-1">
                  {confirmState.title && (
                    <h3 className="mb-1 text-base font-semibold text-gray-900">
                      {confirmState.title}
                    </h3>
                  )}
                  <p className="text-sm leading-5 text-gray-600">{confirmState.message}</p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {confirmState.cancelText || '取消'}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                    confirmState.danger
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-dream-500 hover:bg-dream-600'
                  }`}
                >
                  {confirmState.confirmText || '确定'}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}

// ============================================================
// Hooks
// ============================================================

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within FeedbackProvider')
  return ctx
}

export function useConfirm(): ConfirmContextValue['confirm'] {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within FeedbackProvider')
  return ctx.confirm
}
