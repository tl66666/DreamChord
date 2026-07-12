import { OFFICIAL_DEMO } from '@dreamchord/story-domain'
import type { PrismaClient } from '@prisma/client'

export async function refreshOfficialDemo(client: PrismaClient, authorId: string) {
  return client.$transaction(async (tx) => {
    const project = await tx.project.upsert({
      where: { id: OFFICIAL_DEMO.id },
      update: { title: OFFICIAL_DEMO.title, description: OFFICIAL_DEMO.description, cover: OFFICIAL_DEMO.cover, isPublic: true, isPublished: true, authorId },
      create: { id: OFFICIAL_DEMO.id, title: OFFICIAL_DEMO.title, description: OFFICIAL_DEMO.description, cover: OFFICIAL_DEMO.cover, isPublic: true, isPublished: true, authorId },
    })
    await tx.chapter.deleteMany({ where: { projectId: project.id } })
    await tx.character.deleteMany({ where: { projectId: project.id } })
    await tx.character.createMany({ data: OFFICIAL_DEMO.characters.map((character) => ({ ...character, projectId: project.id })) })
    await tx.chapter.create({ data: {
      projectId: project.id,
      title: OFFICIAL_DEMO.chapterTitle,
      order: 0,
      nodes: { create: OFFICIAL_DEMO.graph.nodes.map((node) => ({ nodeId: node.id, type: node.type, positionX: node.position.x, positionY: node.position.y, data: JSON.stringify(node.data) })) },
      edges: { create: OFFICIAL_DEMO.graph.edges.map((edge) => ({ edgeId: edge.id, source: edge.source, target: edge.target, label: edge.label, sourceHandle: edge.sourceHandle, animated: edge.animated })) },
    } })
    return project
  })
}
