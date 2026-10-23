export type StagePreviewMode = 'full' | 'bust' | 'stage'
export type StagePosition = 'left' | 'center' | 'right'
export type StageFraming = 'full' | 'bust'

export interface StagePresentationInput {
  mode: StagePreviewMode
  position: StagePosition
  totalCharacters: number
  isSystem: boolean
  isSpeaker: boolean
}

export interface StageSpritePresentation {
  framing: StageFraming
  anchorPercent: number
  widthPercent: number
  heightPercent: number
  bottomPercent: number
  imageScale: number
  imageTranslateYPercent: number
  objectFit: 'contain'
  brightness: number
  saturation: number
  opacity: number
  scale: number
  zIndex: number
}

const ANCHORS: Record<1 | 2 | 3, Record<StagePosition, number>> = {
  1: { left: 50, center: 50, right: 50 },
  2: { left: 27, center: 50, right: 73 },
  3: { left: 18, center: 50, right: 82 },
}

/**
 * Pure presentation rules shared by the authoring preview and formal player.
 * Source images are never rewritten; a bust is a controlled display crop.
 */
export function getStageSpritePresentation(input: StagePresentationInput): StageSpritePresentation {
  const count = Math.max(1, Math.min(3, input.totalCharacters)) as 1 | 2 | 3
  const framing: StageFraming = input.isSystem || input.mode === 'full' ? 'full' : 'bust'
  const inspectionMode = input.mode !== 'stage'

  if (inspectionMode) {
    return {
      framing,
      anchorPercent: 50,
      widthPercent: framing === 'full' ? 52 : 68,
      heightPercent: 96,
      bottomPercent: framing === 'full' ? 0 : -22,
      imageScale: framing === 'full' ? 1 : 1.36,
      imageTranslateYPercent: framing === 'full' ? 0 : 16,
      objectFit: 'contain',
      brightness: 1,
      saturation: 1,
      opacity: 1,
      scale: 1,
      zIndex: 10,
    }
  }

  const widthPercent = input.isSystem
    ? (count === 1 ? 34 : count === 2 ? 27 : 22)
    : (count === 1 ? 52 : count === 2 ? 42 : 32)
  const baseAnchor = ANCHORS[count][input.position]
  const anchorPercent = input.isSystem && count > 1
    ? baseAnchor + (input.position === 'right' ? 3 : input.position === 'left' ? -3 : 0)
    : baseAnchor

  return {
    framing,
    anchorPercent,
    widthPercent,
    heightPercent: input.isSystem ? 74 : 92,
    bottomPercent: input.isSystem ? 20 : -18,
    imageScale: input.isSystem ? 0.92 : count === 1 ? 1.42 : 1.34,
    imageTranslateYPercent: input.isSystem ? 0 : 17,
    objectFit: 'contain',
    brightness: input.isSpeaker ? 1 : 0.68,
    saturation: input.isSpeaker ? 1 : 0.72,
    opacity: 1,
    scale: input.isSpeaker ? 1.02 : 0.98,
    zIndex: input.isSpeaker ? 20 : 10,
  }
}

