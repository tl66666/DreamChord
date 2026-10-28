import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export default function AppHeader({ title, actions, wide = false, compact = false }: { title?: string; actions?: ReactNode; wide?: boolean; compact?: boolean }) {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [open, setOpen] = useState(false)
  const links = [{ to: '/', label: '我的故事' }, { to: '/library', label: '素材库' }, { to: '/agent', label: '创作 Agent' }, { to: '/explore', label: '发现作品' }, { to: '/settings', label: '设置' }]
  const nav = (mobile = false) => links.map((item) => <Link key={item.to} to={item.to === '/settings' && location.pathname !== '/settings' ? `/settings?returnTo=${encodeURIComponent(location.pathname + location.search)}` : item.to} aria-current={location.pathname === item.to ? 'page' : undefined} onClick={() => setOpen(false)} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${location.pathname === item.to ? 'bg-dream-50 text-dream-700' : 'text-slate-600 hover:bg-dream-50 hover:text-dream-700'} ${mobile ? 'block' : ''}`}>{item.label}</Link>)
  return <header className={`shrink-0 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-xl sm:px-6 ${compact ? 'py-2.5' : 'py-3.5'}`}>
    <div className={`mx-auto flex items-center justify-between gap-3 ${wide ? 'max-w-[1760px]' : 'max-w-7xl'}`}>
      <Link to="/" className="flex min-w-0 items-center gap-3"><img src="/assets/logo.png" alt="" className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-black/5" /><div className="min-w-0">{title ? <><span className="block text-xs font-semibold text-slate-500">DreamChord</span><h1 className="truncate text-lg font-bold text-slate-950">{title}</h1></> : <span className="text-xl font-bold tracking-tight text-slate-950">DreamChord</span>}</div></Link>
      <nav aria-label="主导航" className="hidden items-center gap-1 lg:flex">{nav()}</nav>
      <div className="flex shrink-0 items-center gap-2">{actions}{!user && !compact && <Link to="/login" className="dc-secondary">登录</Link>}{user && !compact && <button onClick={logout} className="hidden rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 hover:bg-slate-200 xl:block">退出</button>}<button aria-label={open ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 lg:hidden">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button></div>
    </div>
    {open && <nav aria-label="移动端导航" className="mt-3 grid grid-cols-2 gap-1 border-t border-slate-100 pt-3 lg:hidden">{nav(true)}{user && <div className="col-span-2 mt-2 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500"><span>{user.nickname || user.username}</span><button onClick={logout} className="rounded-lg bg-slate-100 px-4 py-2">退出登录</button></div>}</nav>}
  </header>
}
