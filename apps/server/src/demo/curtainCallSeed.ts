import { CURTAIN_CALL_DEMO } from '@dreamchord/story-domain'
import type { PrismaClient } from '@prisma/client'

/** Creates this new example only. Existing story graphs, settings and characters are preserved. */
export async function seedCurtainCall(client: PrismaClient, authorId: string) {
  const d = CURTAIN_CALL_DEMO
  return client.$transaction(async tx => {
    const exists = await tx.project.findUnique({ where: { id: d.id } })
    if (exists) return exists
    return tx.project.create({ data: {
      id: d.id, authorId, title: d.title, description: d.description, cover: d.cover, isPublic: true, isPublished: true,
      defaultSubtitleLocale: 'zh', defaultVoiceLocale: 'ja',
      characters: { create: d.characters.map(({ slug, ...c }) => ({ ...c, sprites: { create: ['normal', 'sad', 'smile'].map(expression => ({ name: expression, url: `/assets/curtain-call/${slug}-${expression}.png` })) } })) },
      chapters: { create: { title: d.chapterTitle, order: 0, nodes: { create: d.graph.nodes.map(n => ({ nodeId: n.id, type: n.type, positionX: n.position.x, positionY: n.position.y, data: JSON.stringify(n.data) })) }, edges: { create: d.graph.edges.map(e => ({ edgeId: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, label: e.label, animated: e.animated })) } } },
    } })
  })
}
