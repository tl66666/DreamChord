import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch, Check, AlertCircle } from 'lucide-react'

export default function ChoiceNode({ data, selected }: NodeProps) {
  const choices = Array.isArray(data.choices) ? (data.choices as string[]) : []
  const safeChoices = choices.length > 0 ? choices : ['继续']

  // 从 data 中获取已配置的边信息（由 FlowEditor 注入）
  const configuredIndices: Set<number> = new Set(
    Array.isArray(data._configuredChoices) ? (data._configuredChoices as number[]) : []
  )

  const allConfigured = safeChoices.every((_, i) => configuredIndices.has(i))

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
        {allConfigured ? (
          <span className="ml-auto flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-medium text-green-600">
            <Check className="h-2.5 w-2.5" /> 已配置
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">
            <AlertCircle className="h-2.5 w-2.5" /> 待配置
          </span>
        )}
      </div>
      <div className="space-y-2">
        {safeChoices.map((choice, index) => {
          const isConfigured = configuredIndices.has(index)
          return (
            <div
              key={`${choice}-${index}`}
              className={`relative rounded-md px-2 py-1.5 pr-6 text-xs ${
                isConfigured
                  ? 'bg-green-50 text-green-700'
                  : 'bg-pink-50 text-pink-700'
              }`}
            >
              <span className={`mr-1 font-mono ${isConfigured ? 'text-green-400' : 'text-pink-400'}`}>
                {String.fromCharCode(65 + index)}.
              </span>
              {choice}
              {isConfigured && (
                <Check className="absolute left-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-green-400 opacity-50" />
              )}
              <Handle
                id={`choice-${index}`}
                type="source"
                position={Position.Right}
                className={`!right-[-16px] !h-3 !w-3 !border-2 !border-white ${
                  isConfigured ? '!bg-green-500' : '!bg-pink-500'
                }`}
                style={{ top: `${34 + index * 34}px` }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
