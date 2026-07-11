import { GitBranch, Image as ImageIcon, MessageSquare, Type, User } from 'lucide-react'
import type { LensType } from './workbenchTypes'

export const NODE_LABEL: Record<string, string> = {
  dialogue: '对话', subtitle: '旁白', choice: '选项', background: '背景', character: '角色',
  transition: '转场', delay: '等待', condition: '条件', setVariable: '变量', jump: '跳转',
}
export const QUICK_TYPES = [
  { type: 'dialogue', label: '对话', icon: MessageSquare },
  { type: 'subtitle', label: '旁白', icon: Type },
  { type: 'choice', label: '选项', icon: GitBranch },
  { type: 'background', label: '背景', icon: ImageIcon },
  { type: 'character', label: '角色', icon: User },
]
export const BRANCH_TYPES = QUICK_TYPES
export const LENS_TYPES: Array<{ id: LensType; label: string; desc: string }> = [
  { id: 'dialogue', label: '角色对话', desc: '角色登场、换表情并说话' },
  { id: 'narration', label: '旁白', desc: '叙述动作、环境和剧情推进' },
  { id: 'thought', label: '心理描写', desc: '角色内心独白，可带立绘状态' },
  { id: 'memory', label: '回忆镜头', desc: '插入过去片段、闪回或梦境' },
  { id: 'system', label: '系统提示', desc: 'Meta 提示、节点异常和界面信息' },
]
export const LENS_LABEL = Object.fromEntries(LENS_TYPES.map((item) => [item.id, item.label])) as Record<LensType, string>

