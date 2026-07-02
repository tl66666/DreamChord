import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Split } from 'lucide-react'

export default function ConditionNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-[180px] rounded-xl border bg-white p-3 shadow-sm ${selected ? 'border-dream-500 ring-2 ring-dream-500/20' : 'border-rose-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-rose-500" />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-rose-600">
        <Split className="h-3.5 w-3.5" />
        分支判断
      </div>
      <div className="text-sm font-medium text-dream-900">{(data.variable as string) || '变量'}</div>
      <div className="text-xs text-dream-500">
        {(data.operator as string) || '=='} {(data.value as string) || '值'}
      </div>
      <div className="relative mt-3 h-4">
        <Handle id="true" type="source" position={Position.Bottom} className="!bg-green-500" style={{ left: '30%' }} />
        <span className="absolute left-[30%] top-4 -translate-x-1/2 text-[10px] text-green-600">真</span>
        <Handle id="false" type="source" position={Position.Bottom} className="!bg-red-500" style={{ left: '70%' }} />
        <span className="absolute left-[70%] top-4 -translate-x-1/2 text-[10px] text-red-600">假</span>
      </div>
    </div>
  )
}
