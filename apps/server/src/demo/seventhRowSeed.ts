import { SEVENTH_ROW_DEMO } from '@dreamchord/story-domain'
import type { PrismaClient } from '@prisma/client'

/** Add a new example; never reset an existing official or user-authored project. */
export async function seedSeventhRow(client: PrismaClient, authorId: string) {
  const demo = SEVENTH_ROW_DEMO
  return client.$transaction(async tx => {
    const existing = await tx.project.findUnique({ where: { id: demo.id } })
    if (existing) return existing
    return tx.project.create({ data: {
      id: demo.id, authorId, title: demo.title, description: demo.description, cover: demo.cover,
      isPublic: true, isPublished: true, defaultSubtitleLocale: 'zh', defaultVoiceLocale: 'ja',
      characters: { create: demo.characters.map(({ slug, ...character }) => ({ ...character, sprites: { create: ['normal', 'sad', 'smile'].map(expression => ({ name: expression, url: `/assets/seventh-row/${slug}-${expression}.png` })) } })) },
      chapters: { create: { title: demo.chapterTitle, order: 0,
        nodes: { create: demo.graph.nodes.map(node => ({ nodeId: node.id, type: node.type, positionX: node.position.x, positionY: node.position.y, data: JSON.stringify(node.data) })) },
        edges: { create: demo.graph.edges.map(edge => ({ edgeId: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, label: edge.label, animated: edge.animated })) },
      } },
    } })
  })
}
