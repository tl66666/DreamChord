import { storyPatchSchema } from '@dreamchord/story-domain'
import { z } from 'zod'
import { AGENT_TOOL_NAMES } from './tools.js'

const toolCallSchema = z.object({
  type: z.literal('tool_call'),
  tool: z.enum(AGENT_TOOL_NAMES),
  input: z.unknown(),
}).strict()

const finalSchema = z.object({
  type: z.literal('final'),
  summary: z.string().min(1).max(10_000),
  plan: z.array(z.string().min(1).max(500)).max(20),
  patch: storyPatchSchema.optional(),
  suggestions: z.array(z.string().min(1).max(1_000)).max(20).optional(),
  memorySuggestions: z.array(z.object({
    kind: z.enum(['canon', 'character', 'preference', 'plot', 'decision', 'artifact']),
    title: z.string().min(1).max(200), content: z.string().min(1).max(5_000), tags: z.array(z.string().min(1).max(50)).max(20).optional(), importance: z.number().int().min(0).max(100).optional(),
  }).strict()).max(12).optional(),
  artifactRefs: z.array(z.object({ type: z.enum(['story-patch', 'asset-variant']), id: z.string().min(1).max(200) }).strict()).max(20).optional(),
}).strict()

const responseSchema = z.discriminatedUnion('type', [toolCallSchema, finalSchema])
export type AgentModelResponse = z.infer<typeof responseSchema>
export type AgentFinalResponse = z.infer<typeof finalSchema>

function extractJsonPayload(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) return fenced[1]
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed
}

function normalizeFinalResponse(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  if (record.type !== 'final') return value
  const normalized: Record<string, unknown> = { ...record, plan: Array.isArray(record.plan) ? record.plan : [] }
  for (const key of ['patch', 'suggestions', 'memorySuggestions', 'artifactRefs']) {
    if (normalized[key] === null) delete normalized[key]
  }
  return normalized
}

export function parseAgentModelResponse(text: string): AgentModelResponse {
  try {
    const parsed: unknown = normalizeFinalResponse(JSON.parse(extractJsonPayload(text)))
    const result = responseSchema.safeParse(parsed)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.') || 'root').join(', ')
      throw new Error(`模型响应格式不正确：${paths}`)
    }
    return result.data
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('模型响应格式不正确')) throw error
    throw new Error('模型响应格式不正确：无法解析 JSON')
  }
}
