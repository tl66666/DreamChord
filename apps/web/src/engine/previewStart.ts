import type { RuntimeStory } from './types'
export function startPreviewAt(story: RuntimeStory, cardId: string | null): RuntimeStory {
  const first = story.scenes.find(s => s.id === cardId)
  return first ? { ...story, scenes: [first, ...story.scenes.filter(s => s !== first)] } : story
}
