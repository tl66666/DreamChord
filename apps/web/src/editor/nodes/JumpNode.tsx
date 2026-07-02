import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ArrowRightCircle } from 'lucide-react'

export default function JumpNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-[160px] rounded-xl border bg-white p-3 shadow-sm ${selected ? 'border-dream-500 ring-2 ring-dream-500/20' : 'border-orange-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-orange-500" />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-orange-600">
        <ArrowRightCircle className="h-3.5 w-3.5" />
        跳转场景
      </div>
      <div className="text-sm font-medium text-dream-900">{(data.targetScene as string) || '目标场景'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500" />
    </div>
  )
}
