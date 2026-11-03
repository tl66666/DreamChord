import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'

const cleanupInclude = Prisma.validator<Prisma.ProjectInclude>()({
  storyBible: true,
  chapters: { include: { nodes: true, edges: true, snapshots: true } },
  characters: { include: { sprites: true, voiceBinding: true } },
  assets: { include: { variants: true } },
  comments: true,
  agentConversations: { include: { messages: true } },
  agentRuns: true,
  storyPatches: { include: { snapshot: true } },
  agentMemories: true,
  characterVoiceBindings: true,
  voiceGenerationJobs: true,
})

/** Full relation snapshot for local backup receipts. Never contains a User/password row. */
export async function loadProjectCleanupSnapshot(projectId: string, ownerId: string, client: PrismaClient | Prisma.TransactionClient) {
  const project = await client.project.findUnique({ where: { id: projectId }, include: cleanupInclude })
  if (!project || project.authorId !== ownerId) throw new Error('清理项目不存在或归属不符。')
  // Legacy import migrations use snake_case fields not all mapped by the current Prisma model.
  // Read those rows verbatim for a lossless backup without changing their schema or data.
  const longTextImports = await client.$queryRaw<Record<string, unknown>[]>(Prisma.sql`SELECT * FROM long_text_imports WHERE project_id = ${projectId}`)
  const longTextImportChunks = await client.$queryRaw<Record<string, unknown>[]>(Prisma.sql`SELECT * FROM long_text_import_chunks WHERE import_id IN (SELECT id FROM long_text_imports WHERE project_id = ${projectId})`)
  return { ...project, longTextImports, longTextImportChunks }
}

function ordered(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  // These arrays contain relation rows, not authored choice arrays (which are stored as JSON strings).
  if (Array.isArray(value)) return value.map(ordered).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, ordered(v)]))
  return value
}
export function projectCleanupFingerprint(snapshot: unknown): string {
  return createHash('sha256').update(JSON.stringify(ordered(snapshot))).digest('hex')
}

/** Internal maintenance boundary, invoked only after verified local backups; no HTTP endpoint or file GC. */
export async function deleteBackedUpOwnedProjects(ownerId: string, expected: { projectId: string; fingerprint: string }[], client: PrismaClient): Promise<{ deletedProjectIds: string[] }> {
  if (!expected.length || expected.length > 20 || new Set(expected.map(p => p.projectId)).size !== expected.length || expected.some(p => !p.projectId || !/^[a-f0-9]{64}$/.test(p.fingerprint))) throw new Error('清理列表或备份指纹无效。')
  return client.$transaction(async tx => {
    for (const receipt of expected) {
      const project = await loadProjectCleanupSnapshot(receipt.projectId, ownerId, tx)
      if (projectCleanupFingerprint(project) !== receipt.fingerprint) throw new Error('备份后项目发生变化，指纹不匹配；整批清理已拒绝。')
    }
    const result = await tx.project.deleteMany({ where: { authorId: ownerId, id: { in: expected.map(p => p.projectId) } } })
    if (result.count !== expected.length) throw new Error('清理项目数量已变化，整批回滚。')
    // Voice profiles, references and media assets remain owned library items. No files are touched.
    return { deletedProjectIds: expected.map(p => p.projectId) }
  }, { timeout: 15000 })
}
