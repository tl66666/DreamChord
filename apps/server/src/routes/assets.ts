import fs from 'node:fs'
import path from 'node:path'
import { Router, type NextFunction, type Response, type Router as ExpressRouter } from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { inspectAudio, type AudioInspection } from '../assets/audioInspector.js'
import { AssetInUseError, PrismaAssetService } from '../assets/assetService.js'
import { inspectImage, type ImageInspection } from '../assets/imageInspector.js'
import { storagePathFromUrl, uploadUrl } from '../assets/storagePaths.js'
import { prisma } from '../lib/prisma.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const uploadDir = process.env.UPLOAD_DIR || './uploads'
const ASSET_TYPES = ['BACKGROUND', 'CG', 'BGM', 'OTHER', 'SETTING'] as const
type AssetType = typeof ASSET_TYPES[number]
const renameSchema = z.object({ name: z.string().trim().min(1).max(200) }).strict()
const processSchema = z.object({ purpose: z.enum(['sprite', 'cg', 'background']), removeWhite: z.boolean().optional(), whiteThreshold: z.number().int().min(180).max(255).optional(), feather: z.number().int().min(0).max(40).optional(), trim: z.boolean().optional() }).strict()
const acceptSchema = z.object({ purpose: z.enum(['sprite', 'cg', 'background']), projectId: z.string().min(1).optional(), characterId: z.string().min(1).optional(), characterName: z.string().trim().min(1).max(100).optional(), expressionName: z.string().trim().min(1).max(100).optional() }).strict()

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

async function assertProjectOwner(client: PrismaClient, projectId: string, userId?: string) {
  const project = await client.project.findUnique({ where: { id: projectId } })
  return Boolean(project && project.authorId === userId)
}

function removeUploadFile(url: string, storageRoot = uploadDir) {
  const filePath = storagePathFromUrl(storageRoot, url)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

async function finalizeUpload(file: Express.Multer.File, type: AssetType, storageRoot: string, relativeDirectory: string): Promise<{
  url: string
  mimeType: string
  image: ImageInspection | null
  audio: AudioInspection | null
}> {
  const buffer = fs.readFileSync(file.path)
  const image = type === 'BGM' ? null : await inspectImage(buffer)
  const audio = type === 'BGM' ? inspectAudio(buffer) : null
  const extension = audio?.extension ?? (image?.format === 'jpeg' ? 'jpg' : image?.format)
  if (!extension) throw new Error('素材格式无法识别')
  const filename = `${path.parse(file.filename).name}.${extension}`
  const url = uploadUrl(path.join(relativeDirectory, filename))
  const destination = storagePathFromUrl(storageRoot, url)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.renameSync(file.path, destination)
  return { url, mimeType: audio?.mimeType ?? image!.mimeType, image, audio }
}

export function createAssetRouter(client: PrismaClient = prisma, storageRoot = uploadDir): ExpressRouter {
  const router: ExpressRouter = Router()
  fs.mkdirSync(storageRoot, { recursive: true })
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, storageRoot),
    filename: (_req, _file, cb) => cb(null, `${uuidv4()}.upload`),
  })
  const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-wav']
      if (allowedMimes.includes(file.mimetype)) cb(null, true)
      else cb(new Error('仅支持 PNG/JPG/GIF/WebP 图片或 MP3/WAV/OGG 音频'))
    },
  })
  const processing = new PrismaAssetService(client, storageRoot)
  const processingError = (res: Response, error: unknown) => {
    const message = error instanceof Error ? error.message : '素材处理失败'
    res.status(error instanceof AssetInUseError ? 409 : message.includes('无权') ? 403 : message.includes('不存在') ? 404 : message.includes('不可') ? 409 : 400).json({ error: message })
  }

  router.use(authenticateToken)

  const listLibrary = (userId: string) => client.asset.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    include: { variants: { orderBy: { createdAt: 'desc' } } },
  })

  router.get('/', async (req: AuthRequest, res: Response) => {
    res.json(await listLibrary(req.userId!))
  })

  router.get('/:projectId', async (req: AuthRequest, res: Response) => {
    if (!(await assertProjectOwner(client, req.params.projectId, req.userId))) return res.status(403).json({ error: '无权访问此项目素材' })
    res.json(await listLibrary(req.userId!))
  })

  router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: '未上传文件' })
    const { projectId, name, type = 'OTHER' } = req.body
    const pendingUrl = uploadUrl(req.file.filename)
    if (!ASSET_TYPES.includes(type)) { removeUploadFile(pendingUrl, storageRoot); return res.status(400).json({ error: '素材类型无效' }) }
    if (projectId && !(await assertProjectOwner(client, projectId, req.userId))) { removeUploadFile(pendingUrl, storageRoot); return res.status(403).json({ error: '无权标记此来源项目' }) }

    let finalized: Awaited<ReturnType<typeof finalizeUpload>>
    try { finalized = await finalizeUpload(req.file, type, storageRoot, path.join('library', req.userId!)) }
    catch (error) { removeUploadFile(pendingUrl, storageRoot); return res.status(400).json({ error: error instanceof Error ? error.message : '素材无效' }) }

    try {
      const asset = await client.asset.create({ data: {
        ownerId: req.userId!, ...(projectId ? { projectId } : {}), name: name || req.file.originalname, type, url: finalized.url, mimeType: finalized.mimeType,
        ...(finalized.image ? { width: finalized.image.width, height: finalized.image.height, hasAlpha: finalized.image.hasAlpha, metadata: JSON.stringify({ format: finalized.image.format, animated: finalized.image.animated, pages: finalized.image.pages, analysis: finalized.image.analysis }) } : {}),
      } })
      res.json(asset)
    } catch (error) {
      removeUploadFile(finalized.url, storageRoot)
      throw error
    }
  })

  router.put('/:assetId/file', upload.single('file'), async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: '未上传文件' })
    const pendingUrl = uploadUrl(req.file.filename)
    const asset = await client.asset.findUnique({ where: { id: req.params.assetId } })
    if (!asset) { removeUploadFile(pendingUrl, storageRoot); return res.status(404).json({ error: '素材不存在' }) }
    if (asset.ownerId !== req.userId) { removeUploadFile(pendingUrl, storageRoot); return res.status(403).json({ error: '无权修改此素材' }) }

    const nextType = req.body.type || asset.type
    if (!ASSET_TYPES.includes(nextType)) { removeUploadFile(pendingUrl, storageRoot); return res.status(400).json({ error: '素材类型无效' }) }
    try { await processing.assertReplaceable(asset.id, req.userId!) }
    catch (error) { removeUploadFile(pendingUrl, storageRoot); processingError(res, error); return }
    let finalized: Awaited<ReturnType<typeof finalizeUpload>>
    try { finalized = await finalizeUpload(req.file, nextType, storageRoot, path.join('library', req.userId!)) }
    catch (error) { removeUploadFile(pendingUrl, storageRoot); return res.status(400).json({ error: error instanceof Error ? error.message : '素材无效' }) }

    let updated
    try {
      updated = await client.asset.update({ where: { id: asset.id }, data: {
        name: req.body.name || asset.name, type: nextType, url: finalized.url, mimeType: finalized.mimeType,
        ...(finalized.image ? { width: finalized.image.width, height: finalized.image.height, hasAlpha: finalized.image.hasAlpha, metadata: JSON.stringify({ format: finalized.image.format, animated: finalized.image.animated, pages: finalized.image.pages, analysis: finalized.image.analysis }) } : { width: null, height: null, hasAlpha: null, metadata: '{}' }),
      } })
    } catch (error) {
      removeUploadFile(finalized.url, storageRoot)
      throw error
    }
    try { await processing.cleanupUnused([asset.url]) } catch (error) { console.error('替换素材时删除旧文件失败', error) }
    res.json(updated)
  })

  router.patch('/:assetId', async (req: AuthRequest, res: Response) => {
    const body = renameSchema.safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: body.error.issues[0]?.message || '请求无效' })
    const asset = await client.asset.findUnique({ where: { id: req.params.assetId } })
    if (!asset) return res.status(404).json({ error: '素材不存在' })
    if (asset.ownerId !== req.userId) return res.status(403).json({ error: '无权修改此素材' })
    res.json(await client.asset.update({ where: { id: asset.id }, data: { name: body.data.name } }))
  })

  router.get('/:assetId/inspection', async (req: AuthRequest, res: Response) => {
    try { res.json(await processing.inspect(req.params.assetId, req.userId!)) } catch (error) { processingError(res, error) }
  })

  router.post('/:assetId/process', async (req: AuthRequest, res: Response) => {
    const body = processSchema.safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: body.error.issues[0]?.message || '处理参数无效' })
    try { res.status(201).json(await processing.process(req.params.assetId, req.userId!, body.data)) } catch (error) { processingError(res, error) }
  })

  router.post('/variants/:variantId/accept', async (req: AuthRequest, res: Response) => {
    const body = acceptSchema.safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: body.error.issues[0]?.message || '接受参数无效' })
    try { res.json(await processing.accept(req.params.variantId, req.userId!, body.data)) } catch (error) { processingError(res, error) }
  })

  router.post('/variants/:variantId/reject', async (req: AuthRequest, res: Response) => {
    try { await processing.reject(req.params.variantId, req.userId!); res.status(204).end() } catch (error) { processingError(res, error) }
  })

  router.delete('/:assetId', async (req: AuthRequest, res: Response) => {
    try { await processing.delete(req.params.assetId, req.userId!); res.json({ success: true }) } catch (error) { processingError(res, error) }
  })

  router.use((error: unknown, _req: AuthRequest, res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError || (error instanceof Error && error.message.startsWith('仅支持'))) {
      return res.status(400).json({ error: error.message })
    }
    next(error)
  })

  return router
}

export default createAssetRouter()
