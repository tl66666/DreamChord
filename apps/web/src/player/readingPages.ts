/** Reading-only pagination. Authored cards, branch IDs and voice hashes stay intact. */
export function splitReadingPages(text: string, limit = 64): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (!normalized || Array.from(normalized).length <= limit) return [normalized]
  const parts: Array<{ text: string; paragraph: boolean }> = []
  for (const paragraph of normalized.split(/\n+/).map(s => s.trim()).filter(Boolean)) {
    let rest = Array.from(paragraph), first = true
    while (rest.length > limit) {
      const prefix = rest.slice(0, limit).join('')
      const breaks = [...prefix.matchAll(/[。！？!?；;，,、]\s*[”’」』）)]*/gu)]
        .map(m => Array.from(prefix.slice(0, m.index! + m[0].length)).length)
        .filter(length => length >= limit * .42)
      let cut = breaks.at(-1) || limit
      if (!breaks.length) {
        const space = prefix.lastIndexOf(' ')
        if (space >= limit * .42) cut = Array.from(prefix.slice(0, space + 1)).length
      }
      // Keep a closing quotation/parenthesis with the sentence it closes.
      while (cut < limit + 2 && /^[”’」』）)]$/.test(rest[cut] || '')) cut++
      parts.push({ text: rest.slice(0, cut).join('').trim(), paragraph: first })
      rest = rest.slice(cut)
      first = false
    }
    if (rest.length) parts.push({ text: rest.join('').trim(), paragraph: first })
  }
  const pages: string[] = []
  let page = '', paragraphs = 0
  for (const part of parts) {
    const join = page && part.paragraph ? '\n' : ''
    if (page && (Array.from(page + join + part.text).length > limit || (part.paragraph && paragraphs >= 2))) {
      pages.push(page); page = ''; paragraphs = 0
    }
    page += (page && part.paragraph ? '\n' : '') + part.text
    if (part.paragraph) paragraphs++
  }
  if (page) pages.push(page)
  return pages
}
