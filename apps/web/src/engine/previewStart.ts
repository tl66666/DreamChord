import type { RuntimeBgmDirection, RuntimeStory } from './types'
export function startPreviewAt(story: RuntimeStory, cardId: string | null): RuntimeStory {
  const first = story.scenes.find(s => s.id === cardId)
  if (!first) return story
  // Follow a reachable route, not storage order (which also contains other branches).
  const byId = new Map(story.scenes.map(scene => [scene.id, scene]))
  const queue: Array<{ id: string; music?: RuntimeBgmDirection }> = story.scenes[0] ? [{ id: story.scenes[0].id }] : []
  const visited = new Set<string>()
  let inherited: RuntimeBgmDirection | undefined
  while (queue.length) {
    const step = queue.shift()!
    if (visited.has(step.id)) continue
    visited.add(step.id)
    const scene = byId.get(step.id)
    if (!scene) continue
    if (scene.id === cardId) { inherited = step.music; break }
    const cue = scene.audio?.bgm
    const music = cue?.action === 'stop' ? undefined : cue?.action === 'play' ? cue
      : cue?.action === 'keep' && step.music ? { ...step.music, ...(cue.volume !== undefined ? { volume: cue.volume } : {}) } : step.music
    const next = [scene.nextSceneId, ...(scene.choiceTargets ?? []), ...(scene.conditionalTargets ?? []).map(target => target.target)]
    for (const id of next) if (id && !visited.has(id)) queue.push({ id, music })
  }
  const cue = first.audio?.bgm
  const music = cue?.action === 'play' || cue?.action === 'stop' ? cue : inherited
    ? { ...inherited, ...(cue?.volume !== undefined ? { volume: cue.volume } : {}), ...(cue?.fadeInMs !== undefined ? { fadeInMs: cue.fadeInMs } : {}) } : cue
  const start = music ? { ...first, audio: { ...first.audio, bgm: music } } : first
  return { ...story, scenes: [start, ...story.scenes.filter(scene => scene.id !== cardId)] }
}
