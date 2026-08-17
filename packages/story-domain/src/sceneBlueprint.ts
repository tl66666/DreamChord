import { z } from 'zod'

const assetHintsSchema = z.object({
  backgroundId: z.string().min(1).max(2_000).optional(),
  characterId: z.string().min(1).max(2_000).optional(),
  cgId: z.string().min(1).max(2_000).optional(),
  bgmId: z.string().min(1).max(2_000).optional(),
}).strict()

const baseBeat = {
  sourceLine: z.number().int().positive().optional(),
  assetHints: assetHintsSchema.optional(),
}

export const sceneBlueprintBeatSchema = z.discriminatedUnion('kind', [
  z.object({ ...baseBeat, kind: z.literal('narration'), text: z.string().trim().min(1).max(20_000), lensType: z.enum(['narration', 'thought', 'memory', 'system']).default('narration') }).strict(),
  z.object({ ...baseBeat, kind: z.literal('dialogue'), speaker: z.string().trim().min(1).max(100), text: z.string().trim().min(1).max(20_000), action: z.string().max(500).optional(), characterId: z.string().min(1).max(2_000).optional() }).strict(),
  z.object({ ...baseBeat, kind: z.literal('choice'), choices: z.array(z.string().trim().min(1).max(200)).min(1).max(12) }).strict(),
  z.object({ ...baseBeat, kind: z.literal('action'), text: z.string().trim().min(1).max(20_000) }).strict(),
  z.object({ ...baseBeat, kind: z.literal('audio'), text: z.string().trim().min(1).max(2_000), audioType: z.enum(['bgm', 'sfx', 'voice']) }).strict(),
])

export const sceneBlueprintSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).optional(),
  summary: z.string().trim().max(2_000).optional(),
  beats: z.array(sceneBlueprintBeatSchema).min(1).max(60),
}).strict()

export type SceneBlueprint = z.infer<typeof sceneBlueprintSchema>
export type SceneBlueprintBeat = z.infer<typeof sceneBlueprintBeatSchema>
