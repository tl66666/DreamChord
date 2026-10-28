import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Music2, GitBranch } from 'lucide-react'

export default function AuthLayout({ children, register = false }: { children: ReactNode; register?: boolean }) {
  return <main className="relative isolate min-h-dvh overflow-hidden bg-[#f8f7fb]">
    <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 -z-10 hidden h-[68%] w-[65%] lg:block [mask-image:linear-gradient(to_bottom,transparent,black_36%),linear-gradient(to_right,black_55%,transparent)] [mask-composite:intersect]"><img src="/assets/ui/writing-nook.webp" alt="" className="h-full w-full object-cover opacity-60" /></div>
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"><Link to="/" className="flex items-center gap-3"><img src="/assets/logo.png" alt="" className="h-10 w-10 rounded-xl" /><span className="text-xl font-bold text-slate-950">DreamChord</span></Link><Link to="/" className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-white hover:text-dream-700">返回首页</Link></header>
    <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-10 pt-5 sm:px-8 lg:min-h-[calc(100dvh-100px)] lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:py-12">
      <section className="hidden min-h-[540px] flex-col justify-between lg:flex"><div><p className="text-xs font-semibold tracking-[0.18em] text-dream-600">DREAMCHORD · STORY STUDIO</p><h2 className="mt-4 whitespace-pre-line text-4xl font-bold leading-tight tracking-tight text-slate-950">{register ? '你的第一个故事，\n从这里开始。' : '接着写，\n故事还在等你。'}</h2><p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">从一个灵感、一句对白开始，为角色安排相遇，也为故事留下不同的结局。</p></div><div className="mt-6 flex w-fit flex-wrap gap-4 rounded-xl bg-[#f8f7fb]/80 px-3 py-2 text-xs text-slate-600 backdrop-blur-sm"><span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-dream-500" />写下对白</span><span className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-dream-500" />编排分支</span><span className="flex items-center gap-2"><Music2 className="h-4 w-4 text-dream-500" />听见角色</span></div></section>
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  </main>
}
