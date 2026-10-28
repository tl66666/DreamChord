import type { VoiceDirection } from '@dreamchord/story-domain'

export interface VoiceProviderCapabilities {
  voiceClone: boolean
  instructionEmotion: boolean
  emotionReference: boolean
  speedControl: boolean
}

export interface VoiceSynthesisInput {
  text: string
  textLanguage: string
  referencePath: string
  promptText: string
  promptLanguage: string
  speed: number
  seed?: number
  direction?: VoiceDirection
}

export interface VoiceSynthesisResult {
  bytes: Buffer
  mimeType: string
  seed?: number
  providerMetadata?: Record<string, unknown>
}

export interface VoiceProviderHealth {
  ok: boolean
  provider: string
  message: string
}

export interface VoiceProvider {
  readonly id: string
  readonly capabilities: VoiceProviderCapabilities
  health(): Promise<VoiceProviderHealth>
  synthesize(input: VoiceSynthesisInput): Promise<VoiceSynthesisResult>
}

