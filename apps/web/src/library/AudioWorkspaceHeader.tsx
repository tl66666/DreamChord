import type { ReactNode } from 'react'
import { Headphones, Music2 } from 'lucide-react'

export default function AudioWorkspaceHeader({ kind, count, action }: { kind: 'voice' | 'music'; count: number; action: ReactNode }) {
  const voice = kind === 'voice'
  const Icon = voice ? Headphones : Music2
  return <header className="relative isolate mb-6 overflow-hidden rounded-2xl bg-dream-900 text-white">
    <img src="/assets/ui/audio-studio.webp" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-right" />
    <div className="absolute inset-0 bg-gradient-to-r from-dream-900/95 via-dream-900/65 to-slate-950/15" />
    <div className="relative flex min-h-[172px] flex-wrap items-end justify-between gap-5 px-6 py-6 lg:px-8">
      <div className="max-w-xl"><p className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.24em] text-amber-200"><Icon className="h-4 w-4" />DREAMCHORD SOUND STUDIO</p><h2 className="text-3xl font-semibold tracking-tight">{voice ? '为角色找到自己的声音' : '让故事从第一声开始'}</h2><p className="mt-3 max-w-lg text-sm leading-6 text-slate-200">{voice ? '选择声线、写下对白，细调每一次欲言又止。中文与日文，分别找到合适的表达。' : '日常的琴音、危机的暗涌、结局的余韵。按剧情挑选配乐，试听与整理始终连贯。'}</p><span className="mt-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/85">{count} {voice ? '个可管理音色' : '条音乐与音效'}</span></div>
      <div className="shrink-0">{action}</div>
    </div>
  </header>
}
