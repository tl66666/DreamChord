import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { inspectAudio } from '../assets/audioInspector.js'
import { inspectImage } from '../assets/imageInspector.js'
import { resolveStoragePath, storagePathFromUrl, uploadUrl as makeUploadUrl } from '../assets/storagePaths.js'
import { prisma } from '../lib/prisma.js'

export const PROJECT_FILE_MAX_BYTES = 20 * 1024 * 1024
export const PROJECT_TOTAL_MAX_BYTES = 64 * 1024 * 1024

const builtinPath = z.string().max(2_000).refine(isSafeBuiltinPath, '内置素材路径不安全')
const uploadUrl = z.string().max(2_000).refine(isSafeUploadUrl, '上传素材路径不安全')
const resourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('embedded'), fileId: z.string().min(1).max(100), sourceUrl: uploadUrl }).strict(),
  z.object({ kind: z.literal('builtin'), path: builtinPath }).strict(),
])
const nodeSchema = z.object({ nodeId: z.string().min(1), type: z.string().min(1), positionX: z.number().finite(), positionY: z.number().finite(), data: z.record(z.unknown()) }).strict()
const edgeSchema = z.object({ edgeId: z.string().min(1), source: z.string().min(1), target: z.string().min(1), label: z.string().nullable(), sourceHandle: z.string().nullable(), animated: z.boolean() }).strict()
const memorySchema = z.object({ kind: z.enum(['canon', 'character', 'preference', 'plot', 'decision', 'artifact']), title: z.string().min(1).max(200), content: z.string().min(1).max(20_000), tags: z.array(z.string().max(50)).max(30), importance: z.number().int().min(0).max(100), isPinned: z.boolean(), sourceType: z.string().max(100) }).strict()
const base64Schema = z.string().max(Math.ceil(PROJECT_FILE_MAX_BYTES / 3) * 4 + 4).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, '素材字节不是有效 base64')

export const projectManifestSchema = z.object({
  format: z.literal('dreamchord-project'), version: z.literal(2), exportedAt: z.string().datetime(),
  project: z.object({ id: z.string().min(1), title: z.string().min(1).max(200), description: z.string().max(10_000), cover: resourceSchema }).strict(),
  storyBible: z.unknown().nullable(),
  chapters: z.array(z.object({ id: z.string().min(1), title: z.string().min(1).max(200), order: z.number().int(), version: z.number().int().min(1), nodes: z.array(nodeSchema).max(20_000), edges: z.array(edgeSchema).max(30_000) }).strict()).max(1_000),
  characters: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(100), description: z.string().max(10_000), color: z.string().max(50), defaultSprite: resourceSchema, sprites: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(100), resource: resourceSchema }).strict()).max(500) }).strict()).max(2_000),
  assets: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(200), type: z.string().min(1).max(50), resource: resourceSchema, mimeType: z.string().nullable(), width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(), hasAlpha: z.boolean().nullable() }).strict()).max(10_000),
  files: z.array(z.object({ id: z.string().min(1).max(100), mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/wav', 'audio/ogg']), byteLength: z.number().int().min(1).max(PROJECT_FILE_MAX_BYTES, '单个素材文件大小超过上限'), sha256: z.string().regex(/^[a-f0-9]{64}$/), data: base64Schema }).strict()).max(10_000),
  memories: z.array(memorySchema).max(10_000),
}).strict()
export type ProjectManifest = z.infer<typeof projectManifestSchema>
type Resource = z.infer<typeof resourceSchema>

function parseJson(value: string): unknown { try { return JSON.parse(value) } catch { return null } }
function parseObject(value: string): Record<string, unknown> { const parsed = parseJson(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {} }
function parseTags(value: string): string[] { const parsed = parseJson(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [] }
function sha256(buffer: Buffer): string { return createHash('sha256').update(buffer).digest('hex') }

function isSafeBuiltinPath(value: string): boolean {
  if (!value.startsWith('/assets/') || value.includes('\\') || value.includes('?') || value.includes('#') || value.includes('%')) return false
  return value.slice('/assets/'.length).split('/').every((part) => Boolean(part) && part !== '.' && part !== '..' && /^[A-Za-z0-9._-]+$/.test(part))
}

function isSafeUploadUrl(value: string): boolean {
  if (!value.startsWith('/uploads/') || value.includes('\\') || value.includes('?') || value.includes('#') || value.includes('%')) return false
  const parts = value.slice('/uploads/'.length).split('/')
  return parts.every((part) => Boolean(part) && part !== '.' && part !== '..' && /^[A-Za-z0-9._-]+$/.test(part))
}

function resourceUrl(resource: Resource, fileUrls: Map<string, string>): string {
  if (resource.kind === 'builtin') return resource.path
  const url = fileUrls.get(resource.fileId)
  if (!url) throw new Error(`备份引用了不存在的素材文件：${resource.fileId}`)
  return url
}

function uniqueIds(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`备份包含重复的${label} ID`)
}

function remapJson(value: unknown, replacements: Map<string, string>): unknown {
  if (typeof value === 'string') return replacements.get(value) ?? value
  if (Array.isArray(value)) return value.map((item) => remapJson(item, replacements))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [replacements.get(key) ?? key, remapJson(item, replacements)]))
  return value
}

function audioMime(buffer: Buffer): 'audio/mpeg' | 'audio/wav' | 'audio/ogg' | null {
  try { return inspectAudio(buffer).mimeType }
  catch { return null }
}

async function verifiedMime(buffer: Buffer, declared?: string | null): Promise<ProjectManifest['files'][number]['mimeType']> {
  if (buffer.length === 0) throw new Error('素材文件内容为空')
  if (declared?.startsWith('audio/')) {
    const actual = audioMime(buffer)
    const normalized = declared === 'audio/x-wav' ? 'audio/wav' : declared
    if (!actual || actual !== normalized) throw new Error('音频内容与 MIME 类型不匹配')
    return actual
  }
  try {
    const inspection = await inspectImage(buffer)
    if (declared && inspection.mimeType !== declared) throw new Error('图片内容与 MIME 类型不匹配')
    return inspection.mimeType as ProjectManifest['files'][number]['mimeType']
  } catch (error) {
    if (error instanceof Error && error.message.includes('MIME')) throw error
    const actual = audioMime(buffer)
    if (actual && (!declared || declared === actual || (declared === 'audio/x-wav' && actual === 'audio/wav'))) return actual
    throw new Error('素材图片内容无效或无法解码')
  }
}

async function decodeAndValidateFiles(manifest: ProjectManifest): Promise<Map<string, { buffer: Buffer; mimeType: ProjectManifest['files'][number]['mimeType'] }>> {
  uniqueIds(manifest.files.map((file) => file.id), '文件')
  const decoded = new Map<string, { buffer: Buffer; mimeType: ProjectManifest['files'][number]['mimeType'] }>()
  let total = 0
  for (const file of manifest.files) {
    const buffer = Buffer.from(file.data, 'base64')
    if (buffer.length !== file.byteLength) throw new Error('素材文件大小校验失败')
    if (buffer.length > PROJECT_FILE_MAX_BYTES) throw new Error('单个素材文件大小超过上限')
    total += buffer.length
    if (total > PROJECT_TOTAL_MAX_BYTES) throw new Error('素材文件聚合大小超过上限')
    if (sha256(buffer) !== file.sha256) throw new Error('素材文件内容校验失败')
    const mimeType = await verifiedMime(buffer, file.mimeType)
    decoded.set(file.id, { buffer, mimeType })
  }
  return decoded
}

export async function exportProject(projectId: string, userId: string, client: PrismaClient = prisma, storageRoot = process.env.UPLOAD_DIR || './uploads'): Promise<ProjectManifest> {
  const project = await client.project.findUnique({ where: { id: projectId }, include: {
    storyBible: true, chapters: { orderBy: { order: 'asc' }, include: { nodes: true, edges: true } },
    characters: { include: { sprites: true } }, assets: true, agentMemories: { where: { status: { not: 'forgotten' }, supersededById: null, conversationId: null } },
  } })
  if (!project) throw new Error('项目不存在')
  if (project.authorId !== userId) throw new Error('无权导出此项目')

  const files: ProjectManifest['files'] = []
  const byUrl = new Map<string, Resource>()
  const embedding = new Map<string, Promise<Resource>>()
  const mimeHints = new Map(project.assets.map((asset) => [asset.url, asset.mimeType]))
  let totalBytes = 0
  const embed = (url: string): Promise<Resource> => {
    const existing = byUrl.get(url)
    if (existing) return Promise.resolve(existing)
    const pending = embedding.get(url)
    if (pending) return pending
    const operation = (async (): Promise<Resource> => {
      if (isSafeBuiltinPath(url)) { const resource = { kind: 'builtin' as const, path: url }; byUrl.set(url, resource); return resource }
      const sourcePath = storagePathFromUrl(storageRoot, url)
      const buffer = await readFile(sourcePath).catch(() => { throw new Error(`素材文件不存在：${url}`) })
      if (buffer.length > PROJECT_FILE_MAX_BYTES) throw new Error('单个素材文件大小超过上限')
      totalBytes += buffer.length
      if (totalBytes > PROJECT_TOTAL_MAX_BYTES) throw new Error('素材文件聚合大小超过上限')
      const mimeType = await verifiedMime(buffer, mimeHints.get(url))
      const id = randomUUID()
      files.push({ id, mimeType, byteLength: buffer.length, sha256: sha256(buffer), data: buffer.toString('base64') })
      const resource = { kind: 'embedded' as const, fileId: id, sourceUrl: url }
      byUrl.set(url, resource)
      return resource
    })()
    embedding.set(url, operation)
    return operation
  }

  const cover = await embed(project.cover)
  const assets = await Promise.all(project.assets.map(async (asset) => ({ id: asset.id, name: asset.name, type: asset.type, resource: await embed(asset.url), mimeType: asset.mimeType, width: asset.width, height: asset.height, hasAlpha: asset.hasAlpha })))
  const characters = await Promise.all(project.characters.map(async (character) => ({ id: character.id, name: character.name, description: character.description ?? '', color: character.color, defaultSprite: await embed(character.defaultSprite), sprites: await Promise.all(character.sprites.map(async (sprite) => ({ id: sprite.id, name: sprite.name, resource: await embed(sprite.url) }))) })))
  return projectManifestSchema.parse({
    format: 'dreamchord-project', version: 2, exportedAt: new Date().toISOString(),
    project: { id: project.id, title: project.title, description: project.description ?? '', cover }, storyBible: project.storyBible ? parseJson(project.storyBible.content) : null,
    chapters: project.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title, order: chapter.order, version: chapter.version, nodes: chapter.nodes.map((node) => ({ nodeId: node.nodeId, type: node.type, positionX: node.positionX, positionY: node.positionY, data: parseObject(node.data) })), edges: chapter.edges.map((edge) => ({ edgeId: edge.edgeId, source: edge.source, target: edge.target, label: edge.label, sourceHandle: edge.sourceHandle, animated: edge.animated })) })),
    characters, assets, files,
    memories: project.agentMemories.map((memory) => ({ kind: memory.kind, title: memory.title, content: memory.content, tags: parseTags(memory.tags), importance: memory.importance, isPinned: memory.isPinned, sourceType: memory.sourceType })),
  })
}

export async function importProject(input: unknown, userId: string, client: PrismaClient = prisma, storageRoot = process.env.UPLOAD_DIR || './uploads'): Promise<{ id: string; title: string }> {
  if (input && typeof input === 'object' && 'format' in input && 'version' in input && (input as { format?: unknown }).format === 'dreamchord-project' && (input as { version?: unknown }).version === 1) throw new Error('旧版 v1 备份不含素材字节，无法安全导入')
  const parsed = projectManifestSchema.safeParse(input)
  if (!parsed.success) throw new Error(`备份格式无效：${parsed.error.issues[0]?.message ?? '无法解析'}`)
  const manifest = parsed.data
  uniqueIds([
    manifest.project.id,
    ...manifest.chapters.map((item) => item.id),
    ...manifest.characters.map((item) => item.id),
    ...manifest.assets.map((item) => item.id),
    ...manifest.characters.flatMap((item) => item.sprites.map((sprite) => sprite.id)),
    ...manifest.files.map((item) => item.id),
  ], '项目内部')
  const decoded = await decodeAndValidateFiles(manifest)

  const projectId = randomUUID()
  const projectDir = resolveStoragePath(storageRoot, projectId)
  const fileUrls = new Map<string, string>()
  const extension: Record<ProjectManifest['files'][number]['mimeType'], string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg' }
  await mkdir(projectDir, { recursive: true })
  try {
    for (const [fileId, file] of decoded) {
      const filename = `${randomUUID()}.${extension[file.mimeType]}`
      await writeFile(resolveStoragePath(storageRoot, path.join(projectId, filename)), file.buffer)
      fileUrls.set(fileId, makeUploadUrl(path.join(projectId, filename)))
    }

    const characterIds = new Map(manifest.characters.map((item) => [item.id, randomUUID()]))
    const assetIds = new Map(manifest.assets.map((item) => [item.id, randomUUID()]))
    const spriteIds = new Map(manifest.characters.flatMap((item) => item.sprites.map((sprite) => [sprite.id, randomUUID()] as const)))
    const chapterIds = new Map(manifest.chapters.map((item) => [item.id, randomUUID()]))
    const replacements = new Map<string, string>([[manifest.project.id, projectId], ...characterIds, ...assetIds, ...spriteIds, ...chapterIds])
    const sourceResources = new Map<string, string>()
    const registerResource = (resource: Resource) => {
      if (resource.kind === 'embedded') {
        sourceResources.set(resource.fileId, resourceUrl(resource, fileUrls))
        replacements.set(resource.sourceUrl, resourceUrl(resource, fileUrls))
      }
    }
    registerResource(manifest.project.cover)
    manifest.assets.forEach((item) => registerResource(item.resource))
    manifest.characters.forEach((item) => { registerResource(item.defaultSprite); item.sprites.forEach((sprite) => registerResource(sprite.resource)) })
    // v2 carries references instead of source URLs. Map file IDs as well so nested manifest data can refer to the same embedded resource.
    sourceResources.forEach((url, fileId) => replacements.set(fileId, url))

    const result = await client.$transaction(async (tx) => {
      const project = await tx.project.create({ data: { id: projectId, title: `${manifest.project.title}（导入）`, description: manifest.project.description, cover: resourceUrl(manifest.project.cover, fileUrls), authorId: userId } })
      if (manifest.storyBible !== null) await tx.storyBible.create({ data: { projectId, content: JSON.stringify(remapJson(manifest.storyBible, replacements)) } })
      for (const chapter of manifest.chapters) {
        uniqueIds(chapter.nodes.map((node) => node.nodeId), '节点')
        uniqueIds(chapter.edges.map((edge) => edge.edgeId), '边')
        const nodeIds = new Map(chapter.nodes.map((node) => [node.nodeId, randomUUID()]))
        const edgeIds = new Map(chapter.edges.map((edge) => [edge.edgeId, randomUUID()]))
        for (const edge of chapter.edges) if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) throw new Error('备份图包含越界的边引用')
        const graphReplacements = new Map([...replacements, ...nodeIds, ...edgeIds])
        await tx.chapter.create({ data: { id: chapterIds.get(chapter.id)!, projectId, title: chapter.title, order: chapter.order, version: chapter.version, nodes: { create: chapter.nodes.map((node) => ({ nodeId: nodeIds.get(node.nodeId)!, type: node.type, positionX: node.positionX, positionY: node.positionY, data: JSON.stringify(remapJson(node.data, graphReplacements)) })) }, edges: { create: chapter.edges.map((edge) => ({ edgeId: edgeIds.get(edge.edgeId)!, source: nodeIds.get(edge.source)!, target: nodeIds.get(edge.target)!, label: edge.label, sourceHandle: edge.sourceHandle, animated: edge.animated })) } } })
      }
      for (const character of manifest.characters) await tx.character.create({ data: { id: characterIds.get(character.id)!, projectId, name: character.name, description: character.description, color: character.color, defaultSprite: resourceUrl(character.defaultSprite, fileUrls), sprites: { create: character.sprites.map((sprite) => ({ id: spriteIds.get(sprite.id)!, name: sprite.name, url: resourceUrl(sprite.resource, fileUrls) })) } } })
      if (manifest.assets.length) await tx.asset.createMany({ data: manifest.assets.map((asset) => ({ id: assetIds.get(asset.id)!, ownerId: userId, projectId, name: asset.name, type: asset.type, url: resourceUrl(asset.resource, fileUrls), mimeType: decoded.get(asset.resource.kind === 'embedded' ? asset.resource.fileId : '')?.mimeType ?? asset.mimeType, width: asset.width, height: asset.height, hasAlpha: asset.hasAlpha, status: 'ready', metadata: JSON.stringify({ importedFromProject: manifest.project.id }) })) })
      if (manifest.memories.length) await tx.agentMemory.createMany({ data: manifest.memories.map((memory) => ({ projectId, userId, status: 'active', ...memory, tags: JSON.stringify(memory.tags), sourceType: `import:${memory.sourceType}` })) })
      return { id: project.id, title: project.title }
    })
    return result
  } catch (error) {
    await rm(projectDir, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}
