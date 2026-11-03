const officialIds = new Set(['dreamchord-paint-prologue', 'dreamchord-curtain-call', 'dreamchord-seventh-row', 'dreamchord-first-thread', 'demo-project-001'])
/** Source projects use fixed IDs; user-created copies always receive their own IDs. */
export function isOfficialStory(project: { id: string }) { return officialIds.has(project.id) }
