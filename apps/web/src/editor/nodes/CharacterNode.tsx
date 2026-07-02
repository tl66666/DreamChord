import { Handle, Position, type NodeProps } from '@xyflow/react'
import { User } from 'lucide-react'

export default function CharacterNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-[160px] rounded-xl border bg-white p-3 shadow-sm ${selected ? 'border-dream-500 ring-2 ring-dream-500/20' : 'border-amber-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500" />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-600">
        <User className="h-3.5 w-3.5" />
        角色控制
      </div>
      <div className="text-sm font-medium text-dream-900">{data.characterId as string}</div>
      <div className="text-xs text-dream-500">
        {data.action as string} · {data.expression as string}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500" />
    </div>
  )
}
