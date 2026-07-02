export function resolveBgUrl(
  backgroundId: string,
  libraryScenes: Array<{ id: string; url: string }>,
): string {
  if (!backgroundId) return ''
  if (backgroundId.startsWith('/uploads/') || backgroundId.startsWith('http')) return backgroundId
  const lib = libraryScenes.find((s) => s.id === backgroundId)
  if (lib) return lib.url
  return `/assets/backgrounds/${backgroundId}.png`
}
