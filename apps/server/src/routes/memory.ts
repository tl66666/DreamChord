import { Router, type Response, type Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { prismaMemoryService, type MemoryService } from '../agent/memoryService.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { parseBody } from '../validation/http.js'

const kindSchema = z.enum(['canon', 'character', 'preference', 'plot', 'decision', 'artifact'])
const statusSchema = z.enum(['suggested', 'active', 'forgotten'])
const memorySchema = z.object({
  kind: kindSchema, title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(20_000),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(), importance: z.number().int().min(0).max(100).optional(),
  status: statusSchema.optional(), isPinned: z.boolean().optional(), sourceType: z.string().trim().min(1).max(100).optional(),
  sourceId: z.string().max(200).optional(), conversationId: z.string().min(1).optional(),
}).strict()
const memoryUpdateSchema = memorySchema.omit({ conversationId: true }).partial().refine((value) => Object.keys(value).length > 0, { message: '至少提供一个修改字段' })
const listQuerySchema = z.object({ conversationId: z.string().min(1).optional(), includeForgotten: z.coerce.boolean().optional() }).strict()
const retrieveQuerySchema = z.object({ q: z.string().trim().min(1).max(4_000), conversationId: z.string().min(1).optional(), limit: z.coerce.number().int().min(1).max(50).optional() }).strict()

function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : '记忆请求失败'
  res.status(message.includes('无权') ? 403 : message.includes('不存在') ? 404 : 400).json({ error: message })
}

export function createMemoryProjectRouter(service: MemoryService = prismaMemoryService): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(authenticateToken)
  router.get('/:projectId/agent/memories/retrieve', async (req: AuthRequest, res) => {
    const query = retrieveQuerySchema.safeParse(req.query)
    if (!query.success) { res.status(400).json({ error: query.error.issues[0]?.message ?? '查询参数无效' }); return }
    try { res.json(await service.retrieve(req.params.projectId, req.userId!, { query: query.data.q, conversationId: query.data.conversationId, limit: query.data.limit })) } catch (error) { handleError(res, error) }
  })
  router.get('/:projectId/agent/memories', async (req: AuthRequest, res) => {
    const query = listQuerySchema.safeParse(req.query)
    if (!query.success) { res.status(400).json({ error: query.error.issues[0]?.message ?? '查询参数无效' }); return }
    try { res.json(await service.list(req.params.projectId, req.userId!, query.data)) } catch (error) { handleError(res, error) }
  })
  router.post('/:projectId/agent/memories', async (req: AuthRequest, res) => {
    const body = parseBody(memorySchema, req, res); if (!body) return
    try { res.status(201).json(await service.create(req.params.projectId, req.userId!, body)) } catch (error) { handleError(res, error) }
  })
  return router
}

export function createMemoryRouter(service: MemoryService = prismaMemoryService): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(authenticateToken)
  router.patch('/memories/:memoryId', async (req: AuthRequest, res) => {
    const body = parseBody(memoryUpdateSchema, req, res); if (!body) return
    try { res.json(await service.update(req.params.memoryId, req.userId!, body)) } catch (error) { handleError(res, error) }
  })
  router.delete('/memories/:memoryId', async (req: AuthRequest, res) => {
    try { await service.forget(req.params.memoryId, req.userId!); res.status(204).end() } catch (error) { handleError(res, error) }
  })
  return router
}
