export function projectCover(project: { id: string; cover?: string | null }) {
  const oldDefault = !project.cover || ['/assets/hero.png', '/assets/covers/default-cover.png'].includes(project.cover)
  if (!oldDefault) return project.cover!
  if (project.id === 'dreamchord-first-thread') return '/assets/covers/first-thread.webp'
  if (project.id === 'demo-project-001') return '/assets/backgrounds/bg-sakura.png'
  return '/assets/covers/story-draft.webp'
}
