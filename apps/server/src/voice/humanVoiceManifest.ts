import { z } from 'zod'

const humanVoiceClipSchema = z.object({
  role: z.string().regex(/^human-[a-z0-9-]+$/),
  name: z.string().min(2),
  clipDescription: z.string().min(2),
  transcript: z.string().min(2),
  emotion: z.string().min(1),
  outputFile: z.string().regex(/^runtime\/[a-z0-9-]+\.ogg$/, 'outputFile must stay under runtime/'),
  sha256: z.string().regex(/^[a-f\d]{64}$/),
  durationSeconds: z.number().min(1).max(30),
}).strict()

const humanVoiceProfileSchema = z.object({
  id: z.string().regex(/^human-[a-z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().min(2),
  language: z.enum(['ja-JP', 'zh-CN']),
  ageTone: z.string().min(1),
  genderTone: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  previewClip: z.string().regex(/^human-[a-z0-9-]+$/),
  clips: z.array(humanVoiceClipSchema).min(1),
}).strict().refine((profile) => profile.clips.some((clip) => clip.role === profile.previewClip), {
  message: 'previewClip must reference a clip in the same profile',
})

const humanVoiceManifestSchema = z.object({
  schemaVersion: z.literal(1),
  packId: z.literal('dreamchord-human'),
  displayName: z.string().min(1),
  description: z.string().min(1),
  generativeAiUsed: z.literal(false, { errorMap: () => ({ message: 'human voice pack must not use generative AI' }) }),
  syntheticSource: z.literal(false, { errorMap: () => ({ message: 'human voice pack must come from human recordings' }) }),
  source: z.object({
    site: z.literal('OtoLogic'),
    attribution: z.literal('OtoLogic'),
    license: z.literal('CC BY 4.0'),
    sourceUrl: z.string().url(),
    licenseUrl: z.string().url(),
    redistributionAllowed: z.literal(true),
  }).strict(),
  usageNote: z.string().min(1),
  profiles: z.array(humanVoiceProfileSchema).min(1),
}).strict()

export type HumanVoiceClip = z.infer<typeof humanVoiceClipSchema>
export type HumanVoiceProfile = z.infer<typeof humanVoiceProfileSchema>
export type HumanVoiceManifest = z.infer<typeof humanVoiceManifestSchema>

export function parseHumanVoiceManifest(value: unknown): HumanVoiceManifest {
  return humanVoiceManifestSchema.parse(value)
}

export function humanVoiceKeys(profile: HumanVoiceProfile, clip: HumanVoiceClip) {
  return {
    assetId: `human-voice-asset-${clip.role}`,
    profileId: `human-voice-profile-${profile.id}`,
    referenceId: `human-voice-reference-${clip.role}`,
  }
}
