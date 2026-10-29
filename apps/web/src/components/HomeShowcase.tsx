import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Expand, ArrowUpRight } from 'lucide-react'
import LibraryDialog from '../library/LibraryDialog'
import { useAuthStore } from '../stores/authStore'

const screens = [
  { id: 'editor', label: '编写故事', title: '把对白、人物与场景放在一起', text: '左侧整理章节和场景，中间写镜头卡，右侧立即预览。复杂分支也能切换到流程图查看。', image: '/assets/showcase/editor.webp', to: '/editor/dreamchord-first-thread', action: '打开示例工作台' },
  { id: 'voices', label: '试听音色', title: '先听见角色，再确定他的声音', text: '比较声线和语言，选择合适的音色并绑定角色。后续台词沿用配置，也保留逐句精修。', image: '/assets/showcase/voices.webp', to: '/library?tab=voices', action: '去声音库试听' },
  { id: 'settings', label: '封面与语言', title: '让每个故事都有自己的模样', text: '选用封面、上传图片，设置中文或日文字幕与配音。作品设置会保存，首页和工作台都能修改。', image: '/assets/showcase/settings.webp', to: '/#my-stories', action: '管理我的故事' },
  { id: 'player', label: '游玩演出', title: '让选择、画面和声音回到故事里', text: '半身立绘、文字与音乐共同呈现剧情。使用作品默认配音，也能在播放设置中单独切换。', image: '/assets/showcase/player.webp', to: '/play/dreamchord-first-thread', action: '试玩官方示例' },
]
export default function HomeShowcase() {
  const user = useAuthStore((state) => state.user)
  const [active, setActive] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const screen = { ...screens[active], to: screens[active].id === 'settings' && !user ? '/login' : screens[active].to }
  return <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6" aria-labelledby="home-interface-title">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-xs font-semibold tracking-widest text-dream-600">看看真实的创作过程</p><h2 id="home-interface-title" className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">从工作台，到故事里的下一幕</h2></div><p className="max-w-md text-sm leading-6 text-slate-500">以下为实际界面截图。切换查看不同步骤，点击图片可以放大。</p></div>
    <div role="tablist" aria-label="创作界面预览" className="mb-5 flex flex-wrap gap-2">{screens.map((item, index) => <button key={item.id} id={`showcase-tab-${item.id}`} role="tab" aria-controls="home-interface-panel" aria-selected={active === index} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = (active + (event.key === 'ArrowRight' ? 1 : -1) + screens.length) % screens.length; setActive(next); document.getElementById(`showcase-tab-${screens[next].id}`)?.focus() } }} className={`min-h-11 rounded-xl border px-5 text-sm font-medium transition ${active === index ? 'border-dream-600 bg-dream-600 text-white shadow-md shadow-dream-100' : 'border-slate-200 bg-white text-slate-600 hover:border-dream-300'}`}>{item.label}</button>)}</div>
    <div id="home-interface-panel" role="tabpanel" aria-labelledby={`showcase-tab-${screen.id}`} className="overflow-hidden rounded-2xl border border-dream-100 bg-white shadow-xl shadow-dream-100/25">
      <button onClick={() => setExpanded(true)} aria-label={`放大${screen.label}界面截图`} className="group relative block w-full bg-[#eeeaf5] text-left"><img src={screen.image} alt={`${screen.label}的真实界面`} loading="lazy" className="aspect-[16/10] w-full object-contain" /><span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition group-hover:bg-white"><Expand className="h-3.5 w-3.5" />放大查看</span></button>
      <div className="flex flex-wrap items-center justify-between gap-5 border-t border-slate-100 p-5 sm:p-7"><div className="max-w-3xl"><h3 className="text-lg font-semibold text-slate-950">{screen.title}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{screen.text}</p></div><Link to={screen.to} onClick={(event) => { if (screen.id === 'settings' && user) { event.preventDefault(); document.getElementById('my-stories')?.scrollIntoView({ behavior: 'smooth' }) } }} className="dc-secondary shrink-0">{screen.action}<ArrowUpRight className="ml-2 h-4 w-4" /></Link></div>
    </div>
    {expanded && <LibraryDialog wide title={`${screen.label} · 界面截图`} onClose={() => setExpanded(false)}><img src={screen.image} alt={`${screen.label}的真实界面放大图`} className="w-full rounded-lg" /></LibraryDialog>}
  </section>
}
