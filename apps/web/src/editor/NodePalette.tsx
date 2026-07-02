import {
  MessageSquare,
  GitBranch,
  Image,
  User,
  MonitorPlay,
  Type,
  Clock,
  Split,
  Variable,
  ArrowRightCircle,
} from 'lucide-react'

interface NodePaletteProps {
  onAddNode: (type: string) => void
}

const CATEGORIES = [
  {
    title: '演出控制',
    items: [
      { type: 'dialogue', label: '对话 / 旁白', icon: MessageSquare, color: 'bg-blue-50 text-blue-700 border-blue-200' },
      { type: 'choice', label: '选项分支', icon: GitBranch, color: 'bg-pink-50 text-pink-700 border-pink-200' },
      { type: 'background', label: '切换背景', icon: Image, color: 'bg-purple-50 text-purple-700 border-purple-200' },
      { type: 'character', label: '角色控制', icon: User, color: 'bg-amber-50 text-amber-700 border-amber-200' },
      { type: 'subtitle', label: '字幕 / 旁白', icon: Type, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
      { type: 'transition', label: '转场效果', icon: MonitorPlay, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      { type: 'delay', label: '延迟执行', icon: Clock, color: 'bg-slate-50 text-slate-700 border-slate-200' },
    ],
  },
  {
    title: '流程控制',
    items: [
      { type: 'condition', label: '分支判断', icon: Split, color: 'bg-rose-50 text-rose-700 border-rose-200' },
      { type: 'setVariable', label: '设置变量', icon: Variable, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      { type: 'jump', label: '跳转场景', icon: ArrowRightCircle, color: 'bg-orange-50 text-orange-700 border-orange-200' },
    ],
  },
]

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <div className="flex w-64 flex-col border-r border-dream-200 bg-white/90 p-4 backdrop-blur-sm">
      <h3 className="mb-4 text-sm font-semibold text-dream-800">节点库</h3>
      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {CATEGORIES.map((category) => (
          <div key={category.title}>
            <h4 className="mb-2 text-xs font-medium text-dream-500">{category.title}</h4>
            <div className="space-y-2">
              {category.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.type}
                    onClick={() => onAddNode(item.type)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition hover:shadow-md ${item.color}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-dream-100 bg-dream-50/50 p-4">
        <h4 className="mb-2 text-xs font-semibold text-dream-700">节点图规则</h4>
        <ul className="space-y-1.5 text-xs leading-relaxed text-dream-600/85">
          <li>1. 普通节点从下一个端口接到下一段剧情。</li>
          <li>2. 选项节点右侧每个圆点都是独立出口。</li>
          <li>3. 需要合流时，把多个分支尾部接到同一个节点。</li>
          <li>4. 选中节点后，在右侧面板编辑角色、背景和文本。</li>
        </ul>
      </div>
    </div>
  )
}
