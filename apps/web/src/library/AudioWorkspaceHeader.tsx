import type { ReactNode } from 'react'
import StudioIntro from '../components/StudioIntro'
export default function AudioWorkspaceHeader({ kind, count, action }: { kind: 'voice' | 'music' | 'scene'; count: number; action: ReactNode }) {
  const info = {
    voice: { title: '角色音色', unit: '个音色', description: '试听声线，分配给故事角色。绑定一次，后续台词沿用。', image: 'voice-collection' },
    music: { title: '音乐与音效', unit: '条素材', description: '按情绪和剧情用途挑选配乐，为故事安排合适的声音。', image: 'music-collection' },
    scene: { title: '背景场景', unit: '个背景', description: '按场所、时间与氛围找画面，预览后带入故事。', image: 'scene-collection' },
  }[kind]
  return <StudioIntro className="mb-6" image={`/assets/ui/${info.image}.webp`}>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold tracking-tight text-slate-950">{info.title}</h2><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">{count} {info.unit}</span></div><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{info.description}</p><div className="mt-4 flex flex-wrap gap-2">{action}</div></div>
  </StudioIntro>
}
