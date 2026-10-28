import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function LibraryDialog({ title, description, children, footer, onClose, busy = false, wide = false }: { title: string; description?: string; children: ReactNode; footer?: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const element = useRef<HTMLElement>(null)
  const id = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  return createPortal(<div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose() }
    if (event.key === 'Tab') {
      event.stopPropagation()
      const controls = Array.from(element.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), audio[controls], a[href]') || [])
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }} onPlayCapture={(event) => { if (event.target instanceof HTMLAudioElement) document.querySelectorAll('audio').forEach((audio) => { if (audio !== event.target) audio.pause() }) }}><section ref={element} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6"><div><h2 id={id} className="text-xl font-bold tracking-tight text-slate-950">{title}</h2>{description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}</div><button aria-label={`关闭${title}`} disabled={busy} onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><X className="h-5 w-5" /></button></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>{footer && <footer className="shrink-0 border-t border-slate-100 bg-slate-50/70 p-4 sm:px-6">{footer}</footer>}
  </section></div>, document.body)
}
