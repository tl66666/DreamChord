import { Router, type Response, type Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { parseBody } from '../validation/http.js'
import { prismaLongImportService, type LongImportService } from '../imports/longImportService.js'

const createSchema = z.object({ fileName: z.string().trim().min(1).max(200), text: z.string().min(1).max(2_000_000), chunkSize: z.number().int().min(1_000).max(50_000).optional() }).strict()

function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : '长篇导入任务失败'
  const status = message.includes('无权') ? 403 : message.includes('不存在') ? 404 : message.includes('不可') || message.includes('只有') ? 409 : 400
  res.status(status).json({ error: message })
}

export function createLongImportRouter(service: LongImportService = prismaLongImportService): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(authenticateToken)
  router.post('/:projectId/import-jobs', async (req: AuthRequest, res) => {
    const body = parseBody(createSchema, req, res); if (!body) return
    try { res.status(202).json(await service.create({ ...body, projectId: req.params.projectId }, req.userId!)) } catch (error) { handleError(res, error) }
  })
  router.get('/:projectId/import-jobs', async (req: AuthRequest, res) => {
    try { res.json(await service.list(req.params.projectId, req.userId!)) } catch (error) { handleError(res, error) }
  })
  router.get('/:projectId/import-jobs/:importId', async (req: AuthRequest, res) => {
    try { res.json(await service.get(req.params.importId, req.userId!)) } catch (error) { handleError(res, error) }
  })
  router.get('/:projectId/import-jobs/:importId/result', async (req: AuthRequest, res) => {
    try { res.json(await service.result(req.params.importId, req.userId!)) } catch (error) { handleError(res, error) }
  })
  for (const [action, method] of [['pause', 'pause'], ['resume', 'resume'], ['cancel', 'cancel'], ['retry', 'retry']] as const) {
    router.post(`/:projectId/import-jobs/:importId/${action}`, async (req: AuthRequest, res) => {
      try { res.json(await service[method](req.params.importId, req.userId!)) } catch (error) { handleError(res, error) }
    })
  }
  return router
}
