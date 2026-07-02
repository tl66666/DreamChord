import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'

export default function ChoiceNode({ data, selected }: NodeProps) {
  const choices = Array.isArray(data.choices) ? (data.choices as string[]) : []
  const safeChoices = choices.length > 0 ? choices : ['继续']

  return (
    <div
      className={`min-w-[230px] rounded-xl border bg-white p-3 shadow-sm ${
        selected ? 'border-dream-500 ring-2 ring-dream-500/20' : 'border-pink-200'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-pink-500" />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-pink-600">
        <GitBranch className="h-3.5 w-3.5" />
        选项分支
      </div>
      <div className="space-y-2">
        {safeChoices.map((choice, index) => (
          <div key={`${choice}-${index}`} className="relative rounded-md bg-pink-50 px-2 py-1.5 pr-6 text-xs text-pink-700">
            <span className="mr-1 font-mono text-pink-400">{index + 1}.</span>
            {choice}
            <Handle
              id={`choice-${index}`}
              type="source"
              position={Position.Right}
              className="!right-[-16px] !h-3 !w-3 !border-2 !border-white !bg-pink-500"
              style={{ top: `${34 + index * 34}px` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
