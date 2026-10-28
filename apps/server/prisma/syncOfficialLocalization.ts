import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { OFFICIAL_DEMO } from '@dreamchord/story-domain'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') })
const prisma = new PrismaClient()
// Adds translations and the naming cue only where the source is still identical.
// Never rebuilds chapters or characters.
async function main() {
  const owner = await prisma.user.findUnique({ where: { username: 'demo' } })
  if (!owner) throw new Error('demo 账号不存在。')
  const chapters = await prisma.chapter.findMany({ where: { projectId: OFFICIAL_DEMO.id, project: { authorId: owner.id } }, include: { nodes: true } })
  let updated = 0, skipped = 0
  for (const chapter of chapters) {
    const changes: Array<{ id: string; data: string }> = []
    for (const stored of chapter.nodes) {
      const source = OFFICIAL_DEMO.graph.nodes.find((node) => node.id === stored.nodeId)
      if (!source?.data.localizations) continue
      const data = JSON.parse(stored.data) as Record<string, unknown>
      if (data.text !== source.data.text || JSON.stringify(data.choices) !== JSON.stringify(source.data.choices)) { skipped++; continue }
      const patch: Record<string, unknown> = {}
      if (!data.localizations) patch.localizations = source.data.localizations
      const audio = data.audio as { bgm?: { action?: string } } | undefined
      if (stored.nodeId === 's6-d1' && audio?.bgm?.action === 'keep') patch.audio = { ...audio, bgm: (source.data.audio as { bgm: unknown }).bgm }
      if (Object.keys(patch).length) changes.push({ id: stored.id, data: JSON.stringify({ ...data, ...patch }) })
      else skipped++
    }
    if (changes.length) await prisma.$transaction(async (tx) => {
      for (const change of changes) await tx.flowNode.update({ where: { id: change.id }, data: { data: change.data } })
      await tx.chapter.update({ where: { id: chapter.id }, data: { version: { increment: 1 } } })
    })
    updated += changes.length
  }
  console.log(`官方示例日文同步：新增 ${updated} 节点，保留 ${skipped} 个已有翻译或已修改节点。`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
