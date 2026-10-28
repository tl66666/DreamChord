import { z } from 'zod'

const shortText = z.string().trim().min(1).max(120)
const language = z.string().trim().min(2).max(24)

export const createVoiceProfileSchema = z.object({
  name: shortText,
  description: z.string().trim().max(1000).optional().default(''),
  language,
  ageTone: z.string().trim().max(60).optional().default(''),
  genderTone: z.string().trim().max(60).optional().default(''),
  tags: z.array(shortText).max(20).optional().default([]),
  defaultEmotion: z.string().trim().max(80).optional().default('自然'),
  defaultSpeed: z.number().min(0.5).max(1.5).optional().default(1),
  authorizationConfirmed: z.literal(true),
  authorizationNote: z.string().trim().min(2).max(1000).optional().default('用户确认拥有本人同意或合法授权'),
}).strict()

export const updateVoiceProfileSchema = z.object({
  name: shortText.optional(),
  description: z.string().trim().max(1000).optional(),
  language: language.optional(),
  ageTone: z.string().trim().max(60).optional(),
  genderTone: z.string().trim().max(60).optional(),
  tags: z.array(shortText).max(20).optional(),
  defaultEmotion: z.string().trim().max(80).optional(),
  defaultSpeed: z.number().min(0.5).max(1.5).optional(),
  status: z.enum(['active', 'disabled', 'revoked']).optional(),
}).strict()

export const attachVoiceReferenceSchema = z.object({
  assetId: z.string().min(1),
  transcript: z.string().trim().min(1).max(2000),
  language,
  emotion: z.string().trim().max(80).optional().default('自然'),
  authorizationConfirmed: z.literal(true),
}).strict()

export const bindCharacterVoiceSchema = z.object({
  projectId: z.string().min(1),
  characterId: z.string().min(1),
}).strict()

export const createVoiceGenerationSchema = z.object({
  projectId: z.string().min(1),
  characterId: z.string().min(1),
  chapterId: z.string().min(1).optional(),
  nodeId: z.string().min(1).max(200).optional(),
  referenceId: z.string().min(1),
  directionMode: z.enum(['auto', 'manual']).optional().default('manual'),
  text: z.string().trim().min(1).max(5000),
  language,
  emotion: z.string().trim().max(80).optional().default('自然'),
  speed: z.number().min(0.5).max(1.5).optional().default(1),
  seed: z.number().int().min(-1).max(2_147_483_647).optional(),
}).strict()

export const acceptVoiceGenerationSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
}).strict()

export type CreateVoiceProfileInput = z.infer<typeof createVoiceProfileSchema>
export type CreateVoiceGenerationInput = z.infer<typeof createVoiceGenerationSchema>

