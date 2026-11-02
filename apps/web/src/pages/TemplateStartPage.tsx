import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Loader2, PenLine, ArrowLeft } from 'lucide-react'
import { createCurtainTemplate, createPaintTemplate, type CurtainTemplateEntry } from '../api/client'
import { useAuthStore } from '../stores/authStore'
import { CURTAIN_REQUEST_KEY, CURTAIN_START_ROUTE, PAINT_REQUEST_KEY, PAINT_START_ROUTE } from '../lib/templateEntry'

export default function TemplateStartPage({ kind = 'curtain' }: { kind?: 'curtain' | 'paint' }) {
  const paint = kind === 'paint'
  const key = paint ? PAINT_REQUEST_KEY : CURTAIN_REQUEST_KEY
  const route = paint ? PAINT_START_ROUTE : CURTAIN_START_ROUTE
  const navigate = useNavigate()
  const token = useAuthStore(s => s.token)
  const loading = useAuthStore(s => s.isLoading)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const task = useRef<Promise<CurtainTemplateEntry> | null>(null)
  const requestId = useRef('')
  useEffect(() => {
    if (!token || loading) return
    let active = true
    if (!requestId.current) {
      try { requestId.current = sessionStorage.getItem(key) || crypto.randomUUID(); sessionStorage.setItem(key, requestId.current) }
      catch { requestId.current = crypto.randomUUID() }
    }
    task.current ??= (paint ? createPaintTemplate : createCurtainTemplate)(requestId.current)
    task.current.then(entry => {
      if (active) navigate(`/editor/${entry.id}?welcome=${kind}&scene=${entry.focusSceneId}&node=${entry.focusNodeId}`, { replace: true })
    }).catch(() => { if (active) setError('副本暂时没有准备好。可以重试，重复点击不会创建多份。') })
    return () => { active = false }
  }, [token, loading, navigate, attempt, key, kind, paint])
  if (!token) return <Navigate to={`/login?next=${encodeURIComponent(route)}`} replace />
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f6fc] px-6 py-12">
    <img src={paint ? '/assets/paint-prologue/workshop.webp' : '/assets/curtain-call/backstage.webp'} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15 blur-sm" />
    <div className="absolute inset-0 bg-gradient-to-b from-[#f8f6fc]/70 via-[#f8f6fc]/80 to-[#f8f6fc]" />
    <section className="relative w-full max-w-lg rounded-3xl border border-white bg-white/90 p-8 shadow-xl shadow-dream-200/20 backdrop-blur-md sm:p-12">
      <PenLine className="mb-6 h-8 w-8 text-dream-600" />
      <p className="mb-2 text-xs font-semibold tracking-widest text-dream-600">故事还可以继续</p>
      <h1 className="text-2xl font-bold text-slate-950">这一次，把笔交给你</h1>
      <p className="mt-4 text-sm leading-7 text-slate-600">{paint ? '正在为你准备《请让这幅画老去》序章的个人副本。角色、场景、日语音色与配乐都会带入。先写下夏禾的下一句，再预览你的续写。原作会完整保留。' : '正在为你准备《谢幕词上的那一句》的个人副本。角色、场景、中日音色和配乐都会带入，进入后就能改写第三种结局。'}</p>
      {error ? <div role="alert" className="mt-6 space-y-4"><p className="text-sm text-rose-700">{error}</p><button className="dc-primary w-full" onClick={() => { task.current = null; setError(''); setAttempt(n => n + 1) }}>重新准备</button></div> : <p role="status" className="mt-7 flex items-center gap-2 text-sm text-dream-700"><Loader2 className="h-4 w-4 animate-spin" />准备你的故事工作台…</p>}
      <Link to="/" className="mt-7 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-dream-700"><ArrowLeft className="h-4 w-4" />返回首页</Link>
    </section>
  </main>
}
