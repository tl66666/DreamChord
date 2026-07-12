import { analyzeStoryGraph, applyStoryPatch, storyPatchSchema, type StoryPatch } from '@dreamchord/story-domain'
import { z } from 'zod'
import { buildInitialContext, type AgentProjectSnapshot } from './context.js'
import type { UniformAgentToolRegistry } from './executor.js'

export const AGENT_TOOL_NAMES = [
  'read_project_brief', 'read_chapter_outline', 'read_scene', 'search_story',
  'read_conversation_context', 'search_memories', 'list_project_assets', 'inspect_asset', 'read_character_profile',
  'analyze_story_graph', 'create_story_patch', 'validate_story_patch',
  'prepare_character_asset', 'prepare_cg_asset', 'prepare_background_asset',
] as const
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number]

interface AgentTool<T> { inputSchema: z.ZodType<T>; execute(input: T): Promise<unknown> }
export type AgentToolRegistry = { [K in AgentToolName]: AgentTool<never> }

export function createAgentToolRegistry(context: {
  snapshot: AgentProjectSnapshot
  chapterId: string
  conversationContext?: unknown[]
  memories?: Array<{ id: string; title: string; content: string }>
  inspectAsset?: (assetId: string) => Promise<unknown>
  prepareAsset?: (assetId: string, purpose: 'sprite' | 'cg' | 'background', recipe: { removeWhite?: boolean; trim?: boolean; whiteThreshold?: number; feather?: number }) => Promise<unknown>
}) {
  const chapter = context.snapshot.chapters.find((item) => item.id === context.chapterId)
  if (!chapter) throw new Error('Agent 章节不存在')
  let proposedPatch: StoryPatch | null = null

  return {
    read_project_brief: {
      inputSchema: z.object({}).strict(),
      async execute(_input: Record<string, never>) { return buildInitialContext(context.snapshot, { scope: 'project' }) },
    },
    read_chapter_outline: {
      inputSchema: z.object({ chapterId: z.string().optional() }).strict(),
      async execute(input: { chapterId?: string }) { return buildInitialContext(context.snapshot, { scope: 'chapter', chapterId: input.chapterId ?? context.chapterId }) },
    },
    read_scene: {
      inputSchema: z.object({ sceneGroupId: z.string().min(1) }).strict(),
      async execute(input: { sceneGroupId: string }) { return buildInitialContext(context.snapshot, { scope: 'scene', chapterId: context.chapterId, targetId: input.sceneGroupId }) },
    },
    search_story: {
      inputSchema: z.object({ query: z.string().min(1).max(200) }).strict(),
      async execute(input: { query: string }) {
        const query = input.query.toLocaleLowerCase()
        return chapter.graph.nodes.filter((node) => JSON.stringify(node.data).toLocaleLowerCase().includes(query)).slice(0, 20)
      },
    },
    read_conversation_context: {
      inputSchema: z.object({}).strict(),
      async execute(_input: Record<string, never>) { return context.conversationContext ?? [] },
    },
    search_memories: {
      inputSchema: z.object({ query: z.string().min(1).max(200) }).strict(),
      async execute(input: { query: string }) {
        const query = input.query.toLocaleLowerCase()
        return (context.memories ?? []).filter((memory) => `${memory.title} ${memory.content}`.toLocaleLowerCase().includes(query)).slice(0, 20)
      },
    },
    list_project_assets: {
      inputSchema: z.object({ type: z.enum(['BACKGROUND', 'CG', 'BGM', 'OTHER']).optional() }).strict(),
      async execute(input: { type?: string }) { return context.snapshot.assets.filter((asset) => !input.type || asset.type === input.type).slice(0, 100) },
    },
    inspect_asset: {
      inputSchema: z.object({ assetId: z.string().min(1) }).strict(),
      async execute(input: { assetId: string }) {
        if (context.inspectAsset) return context.inspectAsset(input.assetId)
        return context.snapshot.assets.find((asset) => asset.id === input.assetId) ?? { error: '素材不存在' }
      },
    },
    read_character_profile: {
      inputSchema: z.object({ characterId: z.string().min(1) }).strict(),
      async execute(input: { characterId: string }) { return context.snapshot.characters.find((character) => character.id === input.characterId || character.name === input.characterId) ?? { error: '角色不存在' } },
    },
    analyze_story_graph: {
      inputSchema: z.object({}).strict(),
      async execute(_input: Record<string, never>) { return analyzeStoryGraph(chapter.graph) },
    },
    create_story_patch: {
      inputSchema: storyPatchSchema,
      async execute(input: StoryPatch) { proposedPatch = storyPatchSchema.parse(input); return { accepted: true, operationCount: proposedPatch.operations.length } },
    },
    validate_story_patch: {
      inputSchema: z.object({}).strict(),
      async execute(_input: Record<string, never>) {
        if (!proposedPatch) return { valid: false, errors: [{ code: 'patch-missing', message: '尚未创建补丁' }] }
        let sequence = 0
        return applyStoryPatch(chapter.graph, proposedPatch, () => `proposed-${sequence++}`).validation
      },
    },
    prepare_character_asset: {
      inputSchema: z.object({ assetId: z.string().min(1), removeWhite: z.boolean().optional(), trim: z.boolean().optional(), whiteThreshold: z.number().int().min(180).max(255).optional(), feather: z.number().int().min(0).max(40).optional() }).strict(),
      async execute(input: { assetId: string; removeWhite?: boolean; trim?: boolean; whiteThreshold?: number; feather?: number }) {
        if (!context.prepareAsset) throw new Error('素材处理工具不可用')
        return context.prepareAsset(input.assetId, 'sprite', input)
      },
    },
    prepare_cg_asset: {
      inputSchema: z.object({ assetId: z.string().min(1), trim: z.boolean().optional() }).strict(),
      async execute(input: { assetId: string; trim?: boolean }) { if (!context.prepareAsset) throw new Error('素材处理工具不可用'); return context.prepareAsset(input.assetId, 'cg', input) },
    },
    prepare_background_asset: {
      inputSchema: z.object({ assetId: z.string().min(1) }).strict(),
      async execute(input: { assetId: string }) { if (!context.prepareAsset) throw new Error('素材处理工具不可用'); return context.prepareAsset(input.assetId, 'background', {}) },
    },
  }
}

export function toUniformAgentToolRegistry(registry: ReturnType<typeof createAgentToolRegistry>): UniformAgentToolRegistry {
  const uniform: UniformAgentToolRegistry = {}
  for (const name of AGENT_TOOL_NAMES) {
    const tool = registry[name]
    uniform[name] = {
      parseInput: (value) => tool.inputSchema.parse(value),
      execute: async (value) => Promise.resolve(Reflect.apply(tool.execute, tool, [value])),
    }
  }
  return uniform
}
