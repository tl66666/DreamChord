import { z } from 'zod'

const starterVoiceSchema = z.object({
  id: z.string().regex(/^dreamchord-[a-z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().min(2),
  language: z.literal('zh-CN'),
  ageTone: z.string().min(1),
  genderTone: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  sourceVoiceId: z.string().regex(/^(zf|zm)_[a-z0-9_]+$/),
  transcript: z.string().regex(/[\u3400-\u9fff]/),
  outputFile: z.string().regex(/^generated\/[a-z0-9-]+\.wav$/, 'outputFile must stay under generated/'),
  sha256: z.string().regex(/^[a-f\d]{64}$/),
  durationSeconds: z.number().min(3).max(30),
}).strict()

const starterVoiceManifestSchema = z.object({
  schemaVersion: z.literal(1),
  packId: z.literal('dreamchord-starter'),
  displayName: z.string().min(1),
  sourceModel: z.literal('hexgrad/Kokoro-82M'),
  sourceUrl: z.string().url(),
  sourceLicense: z.literal('Apache-2.0', { errorMap: () => ({ message: 'starter voices require Apache-2.0' }) }),
  syntheticSource: z.literal(true, { errorMap: () => ({ message: 'starter voices must use a synthetic source' }) }),
  generatedAt: z.string().datetime({ offset: true }),
  voices: z.array(starterVoiceSchema).min(1),
}).strict()

export type StarterVoice = z.infer<typeof starterVoiceSchema>
export type StarterVoiceManifest = z.infer<typeof starterVoiceManifestSchema>

export function parseStarterVoiceManifest(value: unknown): StarterVoiceManifest {
  return starterVoiceManifestSchema.parse(value)
}

export function starterVoiceKeys(voice: StarterVoice) {
  return {
    assetId: `starter-voice-asset-${voice.id}`,
    profileId: `starter-voice-profile-${voice.id}`,
    referenceId: `starter-voice-reference-${voice.id}`,
  }
}
