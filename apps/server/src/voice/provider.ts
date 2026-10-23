export interface VoiceSynthesisInput {
  text: string
  textLanguage: string
  referencePath: string
  promptText: string
  promptLanguage: string
  speed: number
  seed?: number
}

export interface VoiceSynthesisResult {
  bytes: Buffer
  mimeType: string
  seed?: number
}

export interface VoiceProviderHealth {
  ok: boolean
  provider: string
  message: string
}

export interface VoiceProvider {
  readonly id: string
  health(): Promise<VoiceProviderHealth>
  synthesize(input: VoiceSynthesisInput): Promise<VoiceSynthesisResult>
}

