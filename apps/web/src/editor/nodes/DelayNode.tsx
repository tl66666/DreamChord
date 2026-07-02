import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Clock } from 'lucide-react'

export default function DelayNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-[140px] rounded-xl border bg-white p-3 shadow-sm ${selected ? 'border-dream-500 ring-2 ring-dream-500/20' : 'border-slate-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-600">
        <Clock className="h-3.5 w-3.5" />
        延迟
      </div>
      <div className="text-sm font-medium text-dream-900">{(data.seconds as number) ?? 1}s</div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  )
}
