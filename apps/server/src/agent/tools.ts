import { analyzeStoryGraph, applyStoryPatch, storyPatchSchema, type StoryPatch } from '@dreamchord/story-domain'
import { z } from 'zod'
import { buildInitialContext, type AgentProjectSnapshot } from './context.js'

export const AGENT_TOOL_NAMES = [
  'read_project_brief', 'read_chapter_outline', 'read_scene', 'search_story',
  'analyze_story_graph', 'create_story_patch', 'validate_story_patch',
] as const
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number]

interface AgentTool<T> { inputSchema: z.ZodType<T>; execute(input: T): Promise<unknown> }
export type AgentToolRegistry = { [K in AgentToolName]: AgentTool<never> }

export function createAgentToolRegistry(context: { snapshot: AgentProjectSnapshot; chapterId: string }) {
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
  }
}
