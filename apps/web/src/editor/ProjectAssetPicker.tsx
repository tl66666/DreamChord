import { Image, X } from 'lucide-react'
import type { Asset } from '../api/client'

export interface ProjectAssetTarget {
  cardId: string
  field: 'background' | 'characterSprite'
}

export default function ProjectAssetPicker({ assets, target, onSelect, onClose }: {
  assets: Asset[]
  target: ProjectAssetTarget
  onSelect: (target: ProjectAssetTarget, asset: Asset) => void
  onClose: () => void
}) {
  const visible = assets.filter((asset) => target.field === 'background'
    ? asset.type === 'BACKGROUND' || asset.type === 'CG'
    : asset.type === 'CG')
  return (
    <section aria-label="项目素材选择" className="flex min-h-0 flex-col bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-900">{target.field === 'background' ? '选择背景 / CG' : '选择角色源图'}</h2><p className="mt-0.5 text-xs text-slate-500">目标镜头 {target.cardId}</p></div><button type="button" aria-label="关闭素材选择" title="关闭" onClick={onClose}><X className="h-4 w-4" /></button></header>
      <div className="grid grid-cols-2 gap-2 overflow-y-auto p-3">
        {visible.map((asset) => <button key={asset.id} type="button" aria-label={`选择${asset.name}`} onClick={() => onSelect(target, asset)} className="overflow-hidden border border-slate-200 bg-white text-left hover:border-cyan-600"><img src={asset.url} alt="" className="aspect-video w-full object-cover" /><span className="block truncate p-2 text-xs font-medium text-slate-800">{asset.name}</span></button>)}
        {visible.length === 0 && <div className="col-span-2 py-10 text-center text-xs text-slate-500"><Image className="mx-auto mb-2 h-6 w-6 text-slate-300" />暂无可用素材</div>}
      </div>
    </section>
  )
}
