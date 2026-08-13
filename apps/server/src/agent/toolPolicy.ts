import type { AgentToolName } from './tools.js'

export type AgentToolAccess = 'read' | 'prepare' | 'propose' | 'validate'
export type AgentToolDecision = 'automatic' | 'author_review'

export interface AgentToolPolicy {
  tool: AgentToolName
  access: AgentToolAccess
  decision: AgentToolDecision
  label: string
  reason: string
}

const READ_TOOLS = new Set<AgentToolName>([
  'read_project_brief', 'read_chapter_outline', 'read_scene', 'search_story',
  'read_conversation_context', 'search_memories', 'list_project_assets',
  'inspect_asset', 'read_character_profile',
])
const PREPARE_TOOLS = new Set<AgentToolName>([
  'prepare_character_asset', 'prepare_cg_asset', 'prepare_background_asset', 'plan_character_voice',
])
const VALIDATE_TOOLS = new Set<AgentToolName>(['analyze_story_graph', 'validate_story_patch'])

export function getAgentToolPolicy(tool: AgentToolName): AgentToolPolicy {
  if (READ_TOOLS.has(tool)) return { tool, access: 'read', decision: 'automatic', label: '自动读取', reason: '只读取项目上下文，不会修改内容' }
  if (PREPARE_TOOLS.has(tool)) return { tool, access: 'prepare', decision: 'author_review', label: '候选素材', reason: '会生成候选素材或配音方案，接受后才会进入项目' }
  if (VALIDATE_TOOLS.has(tool)) return { tool, access: 'validate', decision: 'automatic', label: '自动校验', reason: '只检查结构和可播放性，不会写入项目' }
  return { tool, access: 'propose', decision: 'author_review', label: '作者审批', reason: '会生成剧情变更草案，必须由作者预览并应用' }
}
