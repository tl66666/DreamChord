import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Type } from 'lucide-react'

export default function SubtitleNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-[180px] rounded-xl border bg-white p-3 shadow-sm ${selected ? 'border-dream-500 ring-2 ring-dream-500/20' : 'border-cyan-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-cyan-500" />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-cyan-600">
        <Type className="h-3.5 w-3.5" />
        字幕 / 旁白
      </div>
      <div className="line-clamp-2 text-xs text-dream-700">{(data.text as string) || '字幕内容'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-500" />
    </div>
  )
}
