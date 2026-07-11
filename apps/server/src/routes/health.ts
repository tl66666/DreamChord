import { analyzeStoryGraph, type StoryGraph, type StoryNodeType } from '@dreamchord/story-domain'
import { Router, type Response, type Router as ExpressRouter } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

export interface HealthProjectGraph { ownerId: string; graph: StoryGraph }
export interface HealthRepository { findProjectGraph(projectId: string): Promise<HealthProjectGraph | null> }

function parseData(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch { return {} }
}

export const prismaHealthRepository: HealthRepository = {
  async findProjectGraph(projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { authorId: true, chapters: { select: { id: true, nodes: true, edges: true } } },
    })
    if (!project) return null
    return {
      ownerId: project.authorId,
      graph: {
        nodes: project.chapters.flatMap((chapter) => chapter.nodes.map((node) => ({
          id: `${chapter.id}:${node.nodeId}`,
          type: node.type as StoryNodeType,
          position: { x: node.positionX, y: node.positionY },
          data: { ...parseData(node.data), chapterId: chapter.id, originalNodeId: node.nodeId },
        }))),
        edges: project.chapters.flatMap((chapter) => chapter.edges.map((edge) => ({
          id: `${chapter.id}:${edge.edgeId}`,
          source: `${chapter.id}:${edge.source}`,
          target: `${chapter.id}:${edge.target}`,
          label: edge.label ?? undefined,
          sourceHandle: edge.sourceHandle ?? undefined,
          animated: edge.animated,
        }))),
      },
    }
  },
}

export function createHealthRouter(repository: HealthRepository = prismaHealthRepository): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(authenticateToken)
  router.get('/:projectId/health', async (req: AuthRequest, res: Response) => {
    try {
      const project = await repository.findProjectGraph(req.params.projectId)
      if (!project) { res.status(404).json({ error: '项目不存在' }); return }
      if (project.ownerId !== req.userId) { res.status(403).json({ error: '无权查看此项目体检' }); return }
      res.json(analyzeStoryGraph(project.graph))
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : '项目体检失败' })
    }
  })
  return router
}
