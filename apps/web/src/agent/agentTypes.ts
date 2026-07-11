import type { StoryGraph, StoryPatchDiff } from '@dreamchord/story-domain'

export type AgentScope = 'card' | 'scene' | 'chapter' | 'project'
export type AgentRunStatus = 'queued' | 'planning' | 'gathering_context' | 'drafting' | 'validating' | 'awaiting_approval' | 'applying' | 'completed' | 'failed' | 'cancelled'
export interface AgentProviderConfig { provider: string; model: string; apiKey: string; baseUrl?: string }
export interface AgentPatchDto { id: string; status: string; payload: { operations: unknown[] }; validation: { valid?: boolean; errors?: unknown[] }; diff: StoryPatchDiff; baseVersion: number; appliedVersion: number | null }
export interface AgentRunDto {
  id: string; status: AgentRunStatus; prompt: string; scope: string; targetId: string | null; provider: string; model: string
  plan: string[]; timeline: Array<{ type?: string; tool?: string; at?: string }>; sources: unknown[]; validation: unknown
  errorCode: string | null; errorMessage: string | null; patch: AgentPatchDto | null
  createdAt: string; updatedAt: string; completedAt: string | null
}
export interface AgentConversationDto { id: string; title: string; scope: string; createdAt: string; updatedAt: string }
export interface StartAgentRunInput {
  projectId: string; conversationId: string; chapterId?: string; prompt: string; scope: AgentScope; targetId?: string; providerConfig: AgentProviderConfig
}
export interface AppliedPatchDto { chapterId: string; version: number; graph: StoryGraph }
