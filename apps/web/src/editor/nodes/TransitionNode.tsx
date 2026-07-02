import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MonitorPlay } from 'lucide-react'

export default function TransitionNode({ data, selected }: NodeProps) {
  const effect = (data.effect as string) || 'fade'
  const duration = (data.duration as number) ?? 1
  return (
    <div className={`min-w-[160px] rounded-xl border bg-white p-3 shadow-sm ${selected ? 'border-dream-500 ring-2 ring-dream-500/20' : 'border-indigo-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-indigo-500" />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-indigo-600">
        <MonitorPlay className="h-3.5 w-3.5" />
        转场效果
      </div>
      <div className="text-sm font-medium text-dream-900">
        {effect === 'fade' && '淡入/淡出'}
        {effect === 'wipe' && '擦除'}
        {effect === 'flash' && '闪烁'}
      </div>
      <div className="text-xs text-dream-500">{duration}s</div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500" />
    </div>
  )
}
