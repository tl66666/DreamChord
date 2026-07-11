import { Router, type Response, type Router as ExpressRouter } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../lib/prisma.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router: ExpressRouter = Router()
const uploadDir = process.env.UPLOAD_DIR || './uploads'

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('仅支持 PNG/JPG/GIF/WebP 图片格式'))
    }
  },
})

router.use(authenticateToken)

router.get('/:projectId', async (req: AuthRequest, res: Response) => {
  const assets = await prisma.asset.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { createdAt: 'desc' },
  })
  res.json(assets)
})

async function assertProjectOwner(projectId: string, userId?: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  return Boolean(project && project.authorId === userId)
}

function removeUploadFile(url: string) {
  if (!url.startsWith('/uploads/')) return
  const filePath = path.resolve(uploadDir, url.replace(/^\/uploads\//, ''))
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' })

  const { projectId, name, type = 'OTHER' } = req.body
  if (!projectId) return res.status(400).json({ error: '缺少 projectId' })
  if (!(await assertProjectOwner(projectId, req.userId))) {
    return res.status(403).json({ error: '无权上传到此项目' })
  }

  const asset = await prisma.asset.create({
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

  const asset = await prisma.asset.findUnique({ where: { id: req.params.assetId } })
  if (!asset) return res.status(404).json({ error: '素材不存在' })
  if (!(await assertProjectOwner(asset.projectId, req.userId))) {
    return res.status(403).json({ error: '无权修改此素材' })
  }

  try {
    removeUploadFile(asset.url)
  } catch (err) {
    console.error('替换素材时删除旧文件失败', err)
  }

  const updated = await prisma.asset.update({
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
  const name = String(req.body.name || '').trim()
  if (!name) return res.status(400).json({ error: '名称不能为空' })

  const asset = await prisma.asset.findUnique({ where: { id: req.params.assetId } })
  if (!asset) return res.status(404).json({ error: '素材不存在' })
  if (!(await assertProjectOwner(asset.projectId, req.userId))) {
    return res.status(403).json({ error: '无权修改此素材' })
  }

  const updated = await prisma.asset.update({
    where: { id: asset.id },
    data: { name },
  })
  res.json(updated)
})

router.delete('/:assetId', async (req: AuthRequest, res: Response) => {
  const asset = await prisma.asset.findUnique({ where: { id: req.params.assetId } })
  if (!asset) return res.status(404).json({ error: '素材不存在' })
  if (!(await assertProjectOwner(asset.projectId, req.userId))) {
    return res.status(403).json({ error: '无权删除此素材' })
  }

  try {
    removeUploadFile(asset.url)
  } catch (err) {
    console.error('删除素材文件失败', err)
  }

  await prisma.asset.delete({ where: { id: asset.id } })
  res.json({ success: true })
})

export default router
