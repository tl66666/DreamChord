import { z } from 'zod'

const dialogueTakeSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+-[a-z]{2}-\d{2}$/),
  role: z.string().regex(/^[a-z0-9-]+$/),
  speaker: z.string().min(1),
  language: z.enum(['zh', 'ja']),
  text: z.string().min(2),
  scene: z.string().min(1),
  emotion: z.string().min(1),
  isReference: z.literal(true),
  instruction: z.string().min(1),
  outputFile: z.string().regex(/^generated\/[a-z0-9-]+\.wav$/, 'outputFile must stay under generated/'),
  sha256: z.string().regex(/^[a-f\d]{64}$/),
  durationSeconds: z.number().min(0.5).max(45),
  generationSeconds: z.number().optional(),
  sampleRate: z.number().int().min(8000),
}).strict()

const dialogueVoiceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  speaker: z.string().min(1),
  genderTone: z.string().min(1),
  ageTone: z.string().min(1),
  direction: z.string().min(2),
}).strict()

const dialogueVoiceManifestSchema = z.object({
  schemaVersion: z.literal(1),
  packId: z.literal('dreamchord-dialogue'),
  displayName: z.string().min(1),
  description: z.string().min(1),
  generativeAiUsed: z.literal(true, { errorMap: () => ({ message: 'dialogue pack is locally synthesized and must say so' }) }),
  syntheticSource: z.literal(true),
  sourceModel: z.literal('Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice'),
  sourceUrl: z.string().url(),
  sourceLicense: z.literal('Apache-2.0'),
  generatedAt: z.string().min(1),
  voices: z.array(dialogueVoiceSchema).min(1),
  takes: z.array(dialogueTakeSchema).min(1),
}).strict().refine((manifest) => manifest.takes.every((take) => manifest.voices.some((voice) => voice.id === take.role && voice.speaker === take.speaker)), {
  message: 'every take must reference a voice in the same pack with matching speaker',
})

export type DialogueTake = z.infer<typeof dialogueTakeSchema>
export type DialogueVoice = z.infer<typeof dialogueVoiceSchema>
export type DialogueVoiceManifest = z.infer<typeof dialogueVoiceManifestSchema>

export function parseDialogueVoiceManifest(value: unknown): DialogueVoiceManifest {
  return dialogueVoiceManifestSchema.parse(value)
}

export function dialogueVoiceKeys(voiceId: string, takeId: string) {
  return {
    profileId: `dialogue-voice-${voiceId}`,
    assetId: `dialogue-voice-asset-${takeId}`,
    referenceId: `dialogue-voice-reference-${takeId}`,
  }
}
