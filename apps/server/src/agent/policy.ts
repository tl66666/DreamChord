import { isImmediateLocalPrompt, shouldUseActionAgent } from './localAssistant.js'

export type AgentPolicyKind = 'local-immediate' | 'local-import' | 'creative-action' | 'conversation' | 'material-plan'

export interface AgentPolicyInput {
  prompt: string
  hasChapter: boolean
  hasSelectedDraft: boolean
  provider: string
  materialMode: 'reuse' | 'prompts'
}

export interface AgentPolicyDecision {
  kind: AgentPolicyKind
  requiresPatch: boolean
}

const CREATIVE_PROMPT = /续写|润色|改写|扩写|重写|剧情|场景|镜头|分支|台词|旁白|角色|背景|CG|可运行|可播放|创作|生成/i

export function decideAgentPolicy(input: AgentPolicyInput): AgentPolicyDecision {
  if (input.hasSelectedDraft) return { kind: 'local-import', requiresPatch: true }

  const creativePrompt = input.hasChapter && CREATIVE_PROMPT.test(input.prompt)
  if (input.materialMode === 'prompts' && creativePrompt) return { kind: 'material-plan', requiresPatch: false }
  if (input.provider === 'local' || isImmediateLocalPrompt(input.prompt)) return { kind: 'local-immediate', requiresPatch: false }
  if (shouldUseActionAgent(input.prompt, input.hasChapter)) return { kind: 'creative-action', requiresPatch: true }
  return { kind: 'conversation', requiresPatch: false }
}
