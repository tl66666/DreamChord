import { CURTAIN_CALL_DEMO } from '@dreamchord/story-domain'

const legacyLevels: Record<string, number> = { 'crossed-out': .18, 'before-stage': .15, 'empty-stage': .18, 'morning-platform': .16 }

/** Only upgrades an untouched cue from the original official mix. Caller restricts project and owner. */
export function upgradeCurtainMusicCue(nodeId: string, data: Record<string, unknown>): Record<string, unknown> | null {
  const canonical = CURTAIN_CALL_DEMO.graph.nodes.find(node => node.id === nodeId)
  if (!canonical || legacyLevels[nodeId] === undefined || data.text !== canonical.data.text) return null
  const audio = data.audio as { bgm?: { action?: string; url?: string; volume?: number } } | undefined
  const next = canonical.data.audio as { bgm?: { url?: string; volume?: number } } | undefined
  if (!next?.bgm || typeof next.bgm.volume !== 'number' || !audio?.bgm || audio.bgm.action !== 'play' || audio.bgm.url !== next.bgm.url || audio.bgm.volume !== legacyLevels[nodeId]) return null
  return { ...data, audio: { ...audio, bgm: { ...audio.bgm, volume: next.bgm.volume } } }
}
