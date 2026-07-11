import { Router, type Response, type Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { parseBody } from '../validation/http.js'

const nodeSchema = z.object({
  nodeId: z.string().min(1).max(200),
  type: z.string().min(1).max(50),
  positionX: z.number().finite(),
  positionY: z.number().finite(),
  data: z.string().max(200_000),
}).strict()

const edgeSchema = z.object({
  edgeId: z.string().min(1).max(300),
  source: z.string().min(1).max(200),
  target: z.string().min(1).max(200),
  label: z.string().max(500).optional(),
  sourceHandle: z.string().max(100).optional(),
  animated: z.boolean(),
}).strict()

export const chapterSaveSchema = z.object({
  baseVersion: z.number().int().positive(),
  nodes: z.array(nodeSchema).max(5_000),
  edges: z.array(edgeSchema).max(10_000),
}).strict()

export type ChapterSavePayload = z.infer<typeof chapterSaveSchema>
export interface ChapterSaveInput extends ChapterSavePayload { projectId: string; chapterId: string }

export class ChapterVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('章节已被其他操作修改')
  }
}

export class ChapterSaveAccessError extends Error {
  constructor(public readonly status: 403 | 404, message: string) { super(message) }
}

export interface ChapterSaveRepository {
  save(input: ChapterSaveInput, userId: string): Promise<number>
}

export const prismaChapterSaveRepository: ChapterSaveRepository = {
  async save(input, userId) {
    const chapter = await prisma.chapter.findFirst({
      where: { id: input.chapterId, projectId: input.projectId },
      select: { version: true, project: { select: { authorId: true } } },
    })
    if (!chapter) throw new ChapterSaveAccessError(404, '章节不存在')
    if (chapter.project.authorId !== userId) throw new ChapterSaveAccessError(403, '无权修改此项目')

    return prisma.$transaction(async (tx) => {
      const claimed = await tx.chapter.updateMany({
        where: { id: input.chapterId, projectId: input.projectId, version: input.baseVersion },
        data: { version: { increment: 1 } },
      })
      if (claimed.count !== 1) {
        const current = await tx.chapter.findUnique({ where: { id: input.chapterId }, select: { version: true } })
        throw new ChapterVersionConflictError(current?.version ?? chapter.version)
      }

      await tx.flowEdge.deleteMany({ where: { chapterId: input.chapterId } })
      await tx.flowNode.deleteMany({ where: { chapterId: input.chapterId } })
      if (input.nodes.length > 0) {
        await tx.flowNode.createMany({ data: input.nodes.map((node) => ({ ...node, chapterId: input.chapterId })) })
      }
      if (input.edges.length > 0) {
        await tx.flowEdge.createMany({
          data: input.edges.map((edge) => ({
            ...edge,
            chapterId: input.chapterId,
            label: edge.label ?? null,
            sourceHandle: edge.sourceHandle ?? null,
          })),
        })
      }
      return input.baseVersion + 1
    })
  },
}

export function createChapterSaveRouter(repository: ChapterSaveRepository = prismaChapterSaveRepository): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(authenticateToken)
  router.put('/:projectId/chapters/:chapterId', async (req: AuthRequest, res: Response) => {
    const body = parseBody(chapterSaveSchema, req, res)
    if (!body) return
    try {
      const version = await repository.save({ ...body, projectId: req.params.projectId, chapterId: req.params.chapterId }, req.userId!)
      res.json({ success: true, version })
    } catch (error) {
      if (error instanceof ChapterVersionConflictError) {
        res.status(409).json({ error: error.message, currentVersion: error.currentVersion })
        return
      }
      if (error instanceof ChapterSaveAccessError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      if (error instanceof Error && error.message === 'forbidden') {
        res.status(403).json({ error: '无权修改此项目' })
        return
      }
      res.status(500).json({ error: error instanceof Error ? error.message : '保存章节失败' })
    }
  })
  return router
}
