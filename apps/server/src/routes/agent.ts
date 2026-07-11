import { Router, type Response, type Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { prismaAgentRunService, type AgentRunService } from '../agent/runService.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { parseBody } from '../validation/http.js'

const scopeSchema = z.enum(['card', 'scene', 'chapter', 'project'])

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
}

function safeProviderUrl(value: string | undefined): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    if (process.env.NODE_ENV !== 'production') return true
    const host = url.hostname.toLowerCase()
    return host !== 'localhost' && host !== '::1' && !isPrivateIpv4(host)
  } catch { return false }
}

export const providerConfigSchema = z.object({
  provider: z.string().min(1).max(100),
  model: z.string().min(1).max(200),
  apiKey: z.string().min(1).max(10_000),
  baseUrl: z.string().max(2_000).optional(),
}).strict().refine((value) => safeProviderUrl(value.baseUrl), { message: '模型地址不安全', path: ['baseUrl'] })

const conversationSchema = z.object({ title: z.string().min(1).max(200), scope: scopeSchema }).strict()
const runSchema = z.object({
  conversationId: z.string().min(1), chapterId: z.string().optional(), prompt: z.string().min(1).max(4_000),
  scope: scopeSchema, targetId: z.string().max(200).optional(), providerConfig: providerConfigSchema,
}).strict()
const retrySchema = z.object({ providerConfig: providerConfigSchema }).strict()

function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Agent 请求失败'
  const status = message.includes('无权') ? 403 : message.includes('不存在') ? 404 : message.includes('不可') ? 409 : 400
  res.status(status).json({ error: message })
}

export function createAgentProjectRouter(service: AgentRunService = prismaAgentRunService): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(authenticateToken)
  router.get('/:projectId/agent/conversations', async (req: AuthRequest, res) => {
    try { res.json(await service.listConversations(req.params.projectId, req.userId!)) } catch (error) { handleError(res, error) }
  })
  router.post('/:projectId/agent/conversations', async (req: AuthRequest, res) => {
    const body = parseBody(conversationSchema, req, res); if (!body) return
    try { res.status(201).json(await service.createConversation(req.params.projectId, req.userId!, body)) } catch (error) { handleError(res, error) }
  })
  router.post('/:projectId/agent/runs', async (req: AuthRequest, res) => {
    const body = parseBody(runSchema, req, res); if (!body) return
    try { res.status(202).json(await service.createRun({ ...body, projectId: req.params.projectId }, req.userId!)) } catch (error) { handleError(res, error) }
  })
  return router
}

export function createAgentRunRouter(service: AgentRunService = prismaAgentRunService): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(authenticateToken)
  router.get('/runs/:runId', async (req: AuthRequest, res) => { try { res.json(await service.getRun(req.params.runId, req.userId!)) } catch (error) { handleError(res, error) } })
  router.post('/runs/:runId/cancel', async (req: AuthRequest, res) => { try { res.json(await service.cancelRun(req.params.runId, req.userId!)) } catch (error) { handleError(res, error) } })
  router.post('/runs/:runId/reject', async (req: AuthRequest, res) => { try { res.json(await service.rejectRun(req.params.runId, req.userId!)) } catch (error) { handleError(res, error) } })
  router.post('/runs/:runId/retry', async (req: AuthRequest, res) => {
    const body = parseBody(retrySchema, req, res); if (!body) return
    try { res.status(202).json(await service.retryRun(req.params.runId, req.userId!, body.providerConfig)) } catch (error) { handleError(res, error) }
  })
  router.post('/runs/:runId/apply', async (req: AuthRequest, res) => { try { res.json(await service.applyRun(req.params.runId, req.userId!)) } catch (error) { handleError(res, error) } })
  router.post('/runs/:runId/undo', async (req: AuthRequest, res) => { try { res.json(await service.undoRun(req.params.runId, req.userId!)) } catch (error) { handleError(res, error) } })
  return router
}
