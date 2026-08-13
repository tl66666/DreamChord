import { Image, Music, Volume2, Mic, X } from 'lucide-react'
import type { Asset } from '../api/client'

export interface ProjectAssetTarget {
  cardId: string
  field: 'background' | 'characterSprite' | 'bgm' | 'sfx' | 'voice'
}

const TARGET_CONFIG = {
  background: { title: '选择背景 / CG', assetTypes: ['BACKGROUND', 'CG'], Icon: Image },
  characterSprite: { title: '选择角色源图', assetTypes: ['CG'], Icon: Image },
  bgm: { title: '选择背景音乐', assetTypes: ['BGM'], Icon: Music },
  sfx: { title: '选择音效', assetTypes: ['SFX'], Icon: Volume2 },
  voice: { title: '选择配音', assetTypes: ['VOICE'], Icon: Mic },
} as const

export default function ProjectAssetPicker({ assets, target, onSelect, onClose }: {
  assets: Asset[]
  target: ProjectAssetTarget
  onSelect: (target: ProjectAssetTarget, asset: Asset) => void
  onClose: () => void
}) {
  const config = TARGET_CONFIG[target.field]
  const visible = assets.filter((asset) => config.assetTypes.includes(asset.type as never))
  const isAudioTarget = target.field === 'bgm' || target.field === 'sfx' || target.field === 'voice'
  const EmptyIcon = config.Icon
  return (
    <section aria-label="项目素材选择" className="flex min-h-0 flex-col bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-900">{config.title}</h2><p className="mt-0.5 text-xs text-slate-500">目标镜头 {target.cardId}</p></div><button type="button" aria-label="关闭素材选择" title="关闭" onClick={onClose}><X className="h-4 w-4" /></button></header>
      <div className="grid grid-cols-2 gap-2 overflow-y-auto p-3">
        {visible.map((asset) => <button key={asset.id} type="button" aria-label={`选择${asset.name}`} onClick={() => onSelect(target, asset)} className="overflow-hidden border border-slate-200 bg-white text-left hover:border-cyan-600">{isAudioTarget ? <div className="flex aspect-video items-center justify-center bg-slate-50"><config.Icon className="h-7 w-7 text-cyan-600" /></div> : <img src={asset.url} alt="" className="aspect-video w-full object-cover" />}<span className="block truncate p-2 text-xs font-medium text-slate-800">{asset.name}</span></button>)}
        {visible.length === 0 && <div className="col-span-2 py-10 text-center text-xs text-slate-500"><EmptyIcon className="mx-auto mb-2 h-6 w-6 text-slate-300" />暂无可用素材</div>}
      </div>
    </section>
  )
}
