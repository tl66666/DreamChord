import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Image } from 'lucide-react'

export default function BackgroundNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-[160px] rounded-xl border bg-white p-3 shadow-sm ${selected ? 'border-dream-500 ring-2 ring-dream-500/20' : 'border-purple-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-purple-600">
        <Image className="h-3.5 w-3.5" />
        切换背景
      </div>
      <div className="text-sm font-medium text-dream-900">{data.backgroundId as string}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500" />
    </div>
  )
}
