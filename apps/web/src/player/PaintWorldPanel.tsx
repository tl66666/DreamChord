import { useEffect, useId, useRef, useState } from 'react'
import { BookOpen, MapPin, UserRound, Users, X } from 'lucide-react'
import { paintWorldDailyRules, paintWorldPeople, paintWorldPlaces, paintWorldStories } from './paintWorldData'

const sections = [
  { id: 'people', label: '人物', Icon: Users },
  { id: 'town', label: '镇子', Icon: MapPin },
  { id: 'stories', label: '生活片段', Icon: BookOpen },
] as const
type Section = typeof sections[number]['id']

export function PaintWorldPanel({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<Section>('people')
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      } else if (event.key === 'Tab') {
        const items = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), [href], [tabindex="0"]')
        if (!items?.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onClose])

  const selectSection = (next: Section) => {
    setSection(next)
    if (contentRef.current) contentRef.current.scrollTop = 0
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#14121c]/85 p-2 backdrop-blur-sm sm:p-6" onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="镇子与人物" aria-labelledby={`${id}-title`} aria-describedby={`${id}-intro`} className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#c4b9d2]/20 bg-[#25222e] text-[#ece8f0] shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
          <div className="min-w-0">
            <p className="mb-1 text-xs tracking-[0.16em] text-[#bcb0cc]">夏日来信与未完之画</p>
            <h2 id={`${id}-title`} className="text-xl font-medium sm:text-2xl">镇子与人物</h2>
            <p id={`${id}-intro`} className="mt-2 max-w-2xl text-sm leading-relaxed text-[#c4bdce]">从柜台、钥匙和一笔还没结清的账，认识住在这里的人。</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭镇子与人物" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#e0d8eb] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8c5ed]"><X size={20} aria-hidden="true" /></button>
        </header>
        <div role="tablist" aria-label="阅读栏目" className="flex shrink-0 gap-1 border-b border-white/10 px-3 sm:px-7">
          {sections.map(({ id: key, label, Icon }, index) => (
            <button key={key} ref={element => { tabsRef.current[index] = element }} type="button" role="tab" id={`${id}-tab-${key}`} aria-controls={`${id}-panel-${key}`} aria-selected={section === key} tabIndex={section === key ? 0 : -1} onClick={() => selectSection(key)} onKeyDown={event => {
              let next = index
              if (event.key === 'ArrowRight') next = (index + 1) % sections.length
              else if (event.key === 'ArrowLeft') next = (index + sections.length - 1) % sections.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = sections.length - 1
              else return
              event.preventDefault()
              selectSection(sections[next].id)
              tabsRef.current[next]?.focus()
            }} className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-t-lg border-b-2 px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#d8c5ed] sm:flex-none sm:px-5 ${section === key ? 'border-[#c9b3df] bg-white/5 text-[#f0e5fa]' : 'border-transparent text-[#bcb4c8] hover:bg-white/5'}`}><Icon size={16} aria-hidden="true" />{label}</button>
          ))}
        </div>
        <div ref={contentRef} className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-7">
          <section role="tabpanel" tabIndex={0} id={`${id}-panel-${section}`} aria-labelledby={`${id}-tab-${section}`} className="outline-none focus-visible:ring-1 focus-visible:ring-[#c9b3df]">
            {section === 'people' && <>
              <p className="mb-6 text-sm leading-7 text-[#bfb6ca]">档案补全了姓名、年龄与工作日常。刘叔和杂货铺阿姨已在正文中出现；陶宁、周岑尚待登场。</p>
              <div className="grid gap-5 md:grid-cols-2">
                {paintWorldPeople.map(person => <article key={person.id} className="overflow-hidden rounded-xl border border-[#c5b8d6]/15 bg-[#302c3b]">
                  {person.portrait && <img src={person.portrait} alt={`${person.name}半身肖像`} className="aspect-square w-full bg-[#393341] object-contain" loading="lazy" width={1024} height={1024} />}
                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-3"><span className="rounded-full border border-[#d5c3e4]/20 px-2.5 py-1 text-xs text-[#cfc1de]">{person.status}</span>{!person.portrait && <UserRound size={24} className="text-[#a396b6]" aria-hidden="true" />}</div>
                    <h3 className="text-xl font-medium">{person.name}</h3>
                    <p className="mb-4 mt-1 text-sm text-[#c6bacf]">{person.age}岁 · {person.occupation}</p>
                    <p className="text-sm leading-7 text-[#bfb6ca]">{person.established ?? person.introduction}</p>
                    <dl className="mt-4 space-y-3 text-sm leading-7">
                      <div><dt className="font-medium text-[#e0d2ed]">平常在忙</dt><dd className="text-[#d3cbdc]">{person.daily}</dd></div>
                      <div><dt className="font-medium text-[#e0d2ed]">眼下想做的事</dt><dd className="text-[#d3cbdc]">{person.wish}</dd></div>
                      <div><dt className="font-medium text-[#e0d2ed]">和大家相处</dt><dd className="text-[#d3cbdc]">{person.boundary}</dd></div>
                    </dl>
                  </div>
                </article>)}
              </div>
            </>}
            {section === 'town' && <>
              <h3 className="text-2xl font-medium">栖川镇</h3>
              <p className="mb-6 mt-3 text-sm leading-7 text-[#c6bdcf]">镇名是本次补充设定，旧四章没有写出镇名。沿河的旧街连着铺子与礼堂，过桥后是车行和文化站。</p>
              <div className="mb-7 rounded-xl border border-[#c6b4d9]/20 bg-[#332e40] p-5 text-sm leading-8 text-[#e1d6ec]" aria-label="镇上路线">
                <p>旧街杂货铺 → 街尾礼堂 → 侧巷河岸 → 石桥 → 车行 → 新街文化站 → 河岸公交站</p>
                <p className="mt-2 text-[#bdb2ca]">去车站也能从杂货铺沿河直走。夏禾收好了车次表，六月六日要搭第二班。</p>
              </div>
              <div className="space-y-6">{[...paintWorldPlaces, ...paintWorldDailyRules].map(place => <article key={place.name} className="border-t border-white/10 pt-5">
                <h4 className="mb-3 text-lg font-medium text-[#e6dcef]">{place.name}</h4>
                <div className="grid gap-4 text-sm leading-7 md:grid-cols-2"><div><p className="mb-1 text-xs text-[#ad9bbe]">正文已呈现</p><p className="text-[#d0c7d9]">{place.established}</p></div><div><p className="mb-1 text-xs text-[#c5b0d8]">新增补充</p><p className="text-[#d0c7d9]">{place.addition}</p></div></div>
              </article>)}</div>
            </>}
            {section === 'stories' && <>
              <p className="mb-2 text-sm text-[#d8c7e8]">补充短篇 · 排练前的镇上日常，不替代主线</p>
              <p className="mb-7 text-sm leading-7 text-[#bfb5ca]">四月二十日，三点排练开始以前。铺子照常进货，礼堂的借用表也排到了午后。</p>
              <div className="mx-auto max-w-2xl space-y-10">{paintWorldStories.map(story => <article key={story.id}>
                <p className="mb-2 text-xs tracking-wider text-[#b8a6ca]">{story.viewpoint}</p>
                <h3 className="mb-5 text-xl font-medium text-[#eee5f5]">{story.title}</h3>
                <div className="space-y-4 text-[15px] leading-8 text-[#ded5e7] sm:text-base">{story.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
              </article>)}</div>
            </>}
          </section>
        </div>
      </div>
    </div>
  )
}

export default PaintWorldPanel
