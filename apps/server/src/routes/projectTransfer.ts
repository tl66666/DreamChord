import { Router, type Router as ExpressRouter } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { exportProject, importProject } from '../project/projectTransfer.js'

export function createProjectTransferRouter(): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(authenticateToken)
  router.get('/:projectId/export', async (req: AuthRequest, res) => {
    try {
      const manifest = await exportProject(req.params.projectId, req.userId!)
      const filename = `${manifest.project.title.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'project'}.dreamchord.json`
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      res.json(manifest)
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败'
      res.status(message.includes('无权') ? 403 : message.includes('不存在') ? 404 : 400).json({ error: message })
    }
  })
  router.post('/import', async (req: AuthRequest, res) => {
    try { res.status(201).json(await importProject(req.body, req.userId!)) }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : '导入失败' }) }
  })
  return router
}
