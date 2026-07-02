import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Variable } from 'lucide-react'

export default function SetVariableNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-[160px] rounded-xl border bg-white p-3 shadow-sm ${selected ? 'border-dream-500 ring-2 ring-dream-500/20' : 'border-emerald-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-emerald-500" />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-600">
        <Variable className="h-3.5 w-3.5" />
        设置变量
      </div>
      <div className="text-sm font-medium text-dream-900">{(data.variable as string) || '变量名'}</div>
      <div className="text-xs text-dream-500">= {(data.value as string) || '值'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500" />
    </div>
  )
}
