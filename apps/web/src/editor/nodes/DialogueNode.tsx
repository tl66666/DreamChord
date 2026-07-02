import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MessageSquare } from 'lucide-react'

export default function DialogueNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-[180px] rounded-xl border bg-white p-3 shadow-sm ${selected ? 'border-dream-500 ring-2 ring-dream-500/20' : 'border-blue-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500" />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-blue-600">
        <MessageSquare className="h-3.5 w-3.5" />
        对话
      </div>
      <div className="text-sm font-semibold text-dream-900">{data.role as string}</div>
      <div className="mt-1 line-clamp-2 text-xs text-dream-600">{data.text as string}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
    </div>
  )
}
