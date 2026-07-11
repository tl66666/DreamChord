import { Router, type Response, type Router as ExpressRouter } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../lib/prisma.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const uploadDir = process.env.UPLOAD_DIR || './uploads'
const ASSET_TYPES = ['BACKGROUND', 'CG', 'BGM', 'OTHER', 'SETTING'] as const
const renameSchema = z.object({ name: z.string().trim().min(1).max(200) }).strict()

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

export function createAssetRouter(client: PrismaClient = prisma, storageRoot = uploadDir): ExpressRouter {
  const router: ExpressRouter = Router()
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, storageRoot),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  })
  const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
      if (allowedMimes.includes(file.mimetype)) cb(null, true)
      else cb(new Error('仅支持 PNG/JPG/GIF/WebP 图片格式'))
    },
  })

  router.use(authenticateToken)

router.get('/:projectId', async (req: AuthRequest, res: Response) => {
  if (!(await assertProjectOwner(client, req.params.projectId, req.userId))) return res.status(403).json({ error: '无权访问此项目素材' })
  const assets = await client.asset.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { createdAt: 'desc' },
  })
  res.json(assets)
})

async function assertProjectOwner(client: PrismaClient, projectId: string, userId?: string) {
  const project = await client.project.findUnique({ where: { id: projectId } })
  return Boolean(project && project.authorId === userId)
}

function removeUploadFile(url: string, storageRoot = uploadDir) {
  if (!url.startsWith('/uploads/')) return
  const filePath = path.resolve(storageRoot, url.replace(/^\/uploads\//, ''))
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' })

  const { projectId, name, type = 'OTHER' } = req.body
  if (!projectId) return res.status(400).json({ error: '缺少 projectId' })
  if (!ASSET_TYPES.includes(type)) { removeUploadFile(`/uploads/${req.file.filename}`, storageRoot); return res.status(400).json({ error: '素材类型无效' }) }
  if (!(await assertProjectOwner(client, projectId, req.userId))) {
    removeUploadFile(`/uploads/${req.file.filename}`, storageRoot)
    return res.status(403).json({ error: '无权上传到此项目' })
  }

  const asset = await client.asset.create({
    data: {
      projectId,
      name: name || req.file.originalname,
      type,
      url: `/uploads/${req.file.filename}`,
    },
  })

  res.json(asset)
})

router.put('/:assetId/file', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' })

  const asset = await client.asset.findUnique({ where: { id: req.params.assetId } })
  if (!asset) return res.status(404).json({ error: '素材不存在' })
  if (!(await assertProjectOwner(client, asset.projectId, req.userId))) {
    return res.status(403).json({ error: '无权修改此素材' })
  }

  try {
    removeUploadFile(asset.url, storageRoot)
  } catch (err) {
    console.error('替换素材时删除旧文件失败', err)
  }

  const nextType = req.body.type || asset.type
  if (!ASSET_TYPES.includes(nextType)) return res.status(400).json({ error: '素材类型无效' })
  const updated = await client.asset.update({
    where: { id: asset.id },
    data: {
      name: req.body.name || asset.name,
      type: req.body.type || asset.type,
      url: `/uploads/${req.file.filename}`,
    },
  })

  res.json(updated)
})

router.patch('/:assetId', async (req: AuthRequest, res: Response) => {
  const body = renameSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: body.error.issues[0]?.message || '请求无效' })
  const name = body.data.name

  const asset = await client.asset.findUnique({ where: { id: req.params.assetId } })
  if (!asset) return res.status(404).json({ error: '素材不存在' })
  if (!(await assertProjectOwner(client, asset.projectId, req.userId))) {
    return res.status(403).json({ error: '无权修改此素材' })
  }

  const updated = await client.asset.update({
    where: { id: asset.id },
    data: { name },
  })
  res.json(updated)
})

router.delete('/:assetId', async (req: AuthRequest, res: Response) => {
  const asset = await client.asset.findUnique({ where: { id: req.params.assetId } })
  if (!asset) return res.status(404).json({ error: '素材不存在' })
  if (!(await assertProjectOwner(client, asset.projectId, req.userId))) {
    return res.status(403).json({ error: '无权删除此素材' })
  }

  try {
    removeUploadFile(asset.url, storageRoot)
  } catch (err) {
    console.error('删除素材文件失败', err)
  }

  await client.asset.delete({ where: { id: asset.id } })
  res.json({ success: true })
})

  return router
}

export default createAssetRouter()
