import type { ReactNode } from 'react'

/** One continuous surface; illustrations have no separate tile or frame. */
export default function StudioIntro({ children, image, landscape = false, className = '' }: { children: ReactNode; image: string; landscape?: boolean; className?: string }) {
  return <section className={`dc-studio-intro ${className}`}>
    <div className="relative z-10 min-w-0 px-6 py-7 sm:px-8 sm:py-9">{children}</div>
    <div aria-hidden="true" className={`dc-studio-art ${landscape ? 'dc-studio-art-landscape' : ''}`}><img src={image} alt="" /></div>
  </section>
}
