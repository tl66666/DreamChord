import type { StoryNode } from './types.js'

export const PAINT_SCORE = {
  'tam-atelier': '/assets/audio/paint-book/tam-atelier.ogg',
  'tam-ame': '/assets/audio/paint-book/tam-ame.ogg',
  'maou-acoustic29': '/assets/audio/paint-book/maoudamashii-acoustic29.ogg',
  'maou-piano12': '/assets/audio/paint-book/maoudamashii-piano12.ogg',
  'maou-healing15': '/assets/audio/paint-book/maoudamashii-healing15.ogg',
  'ds-chaolu': '/assets/audio/paint-book/dragonic-symphony-chaolu.ogg',
  'amacha-tanken': '/assets/audio/paint-book/amacha-tanken.ogg',
  'amacha-yume': '/assets/audio/paint-book/amacha-yume.ogg',
} as const
export type PaintScoreId = keyof typeof PAINT_SCORE
export type PaintScoreCue = { nodeId: string; track: PaintScoreId; volume: number } | { nodeId: string; stop: true } | { nodeId: string; keep: true; volume: number }
export function paintBgm(track: PaintScoreId, volume = .5) {
  return { action: 'play' as const, url: PAINT_SCORE[track], volume, fadeInMs: 2200, fadeOutMs: 1600 }
}
/** Attach only music direction, retaining paper/wood effects and any bound dialogue. */
export function applyPaintScore(nodes: StoryNode[], cues: readonly PaintScoreCue[]) {
  for (const cue of cues) {
    const node = nodes.find(n => n.id === cue.nodeId)
    if (!node) throw new Error(`Missing scored story beat: ${cue.nodeId}`)
    const bgm = 'track' in cue ? paintBgm(cue.track, cue.volume) : 'stop' in cue ? { action: 'stop', fadeOutMs: 1400 } : { action: 'keep', volume: cue.volume }
    node.data.audio = { ...(node.data.audio as Record<string, unknown> | undefined), bgm }
  }
}
