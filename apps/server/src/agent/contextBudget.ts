export interface ContextSource {
  id: string
  kind: string
  content: string
  priority: number
  score: number
}

export interface ContextSelection {
  sources: ContextSource[]
  omittedIds: string[]
  usedCharacters: number
}

export function selectContextSources(sources: ContextSource[], characterBudget: number): ContextSelection {
  const budget = Math.max(0, Math.floor(characterBudget))
  const ordered = [...sources].sort((left, right) =>
    left.priority - right.priority || right.score - left.score || left.id.localeCompare(right.id),
  )
  const selected: ContextSource[] = []
  const omittedIds: string[] = []
  let usedCharacters = 0

  for (const source of ordered) {
    if (usedCharacters + source.content.length <= budget) {
      selected.push(source)
      usedCharacters += source.content.length
    } else {
      omittedIds.push(source.id)
    }
  }

  return { sources: selected, omittedIds, usedCharacters }
}
