import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { processImage, type ImageRecipe } from './imageProcessor.js'
import { inspectImage } from './imageInspector.js'

export interface AcceptAssetInput {
  purpose: ImageRecipe['purpose']
  characterId?: string
  characterName?: string
  expressionName?: string
}

export class AssetInUseError extends Error {
  constructor() {
    super('素材仍被项目内容或角色使用，请先解除引用')
    this.name = 'AssetInUseError'
  }
}

function safePath(root: string, relative: string): string {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, relative)
  const relation = path.relative(resolvedRoot, resolved)
  if (relation.startsWith('..') || path.isAbsolute(relation)) throw new Error('素材路径不安全')
  return resolved
}

export class PrismaAssetService {
  constructor(private readonly client: PrismaClient = prisma, private readonly storageRoot = process.env.UPLOAD_DIR || './uploads') {}

  async inspect(assetId: string, userId: string) {
    const asset = await this.requireOwnedAsset(assetId, userId)
    const source = await readFile(this.pathFromUrl(asset.url)).catch(() => { throw new Error('原始素材文件不存在') })
    const inspection = await inspectImage(source)
    const { project: _project, ...publicAsset } = asset
    return { asset: publicAsset, ...inspection }
  }

  async process(assetId: string, userId: string, recipe: ImageRecipe) {
    const asset = await this.requireOwnedAsset(assetId, userId)
    const sourcePath = this.pathFromUrl(asset.url)
    const source = await readFile(sourcePath).catch(() => { throw new Error('原始素材文件不存在') })
    const processed = await processImage(source, recipe)
    const filename = `${randomUUID()}.${processed.extension}`
    const relative = path.join(asset.projectId, 'variants', filename)
    const outputPath = safePath(this.storageRoot, relative)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, processed.buffer)
    return this.client.assetVariant.create({ data: {
      assetId: asset.id, kind: recipe.purpose, status: 'proposed', url: `/uploads/${relative.replaceAll('\\', '/')}`,
      mimeType: processed.inspection.mimeType, width: processed.inspection.width, height: processed.inspection.height,
      metadata: JSON.stringify({ recipe, sourceAnalysis: (await inspectImage(source)).analysis, outputAnalysis: processed.inspection.analysis }),
    } })
  }

  async accept(variantId: string, userId: string, input: AcceptAssetInput) {
    const variant = await this.requireOwnedVariant(variantId, userId)
    if (variant.status !== 'proposed') throw new Error('素材产物当前不可接受')
    if (variant.kind !== input.purpose) throw new Error('素材用途不匹配')
    const original = variant.asset
    const accepted = await this.client.$transaction(async (tx) => {
      let character: { id: string; name: string } | null = null
      const derived = await tx.asset.create({ data: {
        projectId: original.projectId, name: `${original.name}-${input.purpose}`, type: input.purpose === 'background' ? 'BACKGROUND' : 'CG',
        url: variant.url, mimeType: variant.mimeType, width: variant.width, height: variant.height, hasAlpha: input.purpose === 'sprite',
        status: 'ready', metadata: JSON.stringify({ sourceAssetId: original.id, variantId: variant.id }),
      } })
      if (input.purpose === 'sprite') {
        if (input.characterId) {
          character = await tx.character.findFirst({ where: { id: input.characterId, projectId: original.projectId }, select: { id: true, name: true } })
          if (!character) throw new Error('角色不存在')
        } else {
          const name = input.characterName?.trim()
          if (!name) throw new Error('需要角色名称')
          character = await tx.character.upsert({ where: { projectId_name: { projectId: original.projectId, name } }, update: {}, create: { projectId: original.projectId, name, defaultSprite: variant.url }, select: { id: true, name: true } })
        }
        await tx.sprite.create({ data: { characterId: character.id, name: input.expressionName?.trim() || 'default', url: variant.url } })
        await tx.character.update({ where: { id: character.id }, data: { defaultSprite: variant.url } })
      }
      await tx.assetVariant.update({ where: { id: variant.id }, data: { status: 'accepted' } })
      return { derived, character }
    })
    return { variant: { ...variant, status: 'accepted' }, asset: accepted.derived, character: accepted.character }
  }

  async reject(variantId: string, userId: string): Promise<void> {
    const variant = await this.requireOwnedVariant(variantId, userId)
    if (variant.status !== 'proposed') throw new Error('素材产物当前不可拒绝')
    const removableUrls = await this.client.$transaction(async (tx) => {
      await tx.assetVariant.update({ where: { id: variant.id }, data: { status: 'rejected' } })
      return this.findUnreferencedUrls(tx, [variant.url], variant.id)
    })
    await this.removeFiles(removableUrls)
  }

  async delete(assetId: string, userId: string): Promise<void> {
    const removableUrls = await this.client.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        include: { variants: { select: { url: true } }, project: { select: { authorId: true } } },
      })
      if (!asset) throw new Error('素材不存在')
      if (asset.project.authorId !== userId) throw new Error('无权访问此素材')

      if (await this.countContentReferences(tx, asset.url) > 0) throw new AssetInUseError()

      const urls = [...new Set([asset.url, ...asset.variants.map(({ url }) => url)])]
      await tx.asset.delete({ where: { id: asset.id } })

      return this.findUnreferencedUrls(tx, urls)
    })

    await this.removeFiles(removableUrls)
  }

  async assertReplaceable(assetId: string, userId: string): Promise<void> {
    const asset = await this.requireOwnedAsset(assetId, userId)
    const references = await this.client.$transaction((tx) => this.countContentReferences(tx, asset.url))
    if (references > 0) throw new AssetInUseError()
  }

  async cleanupUnused(urls: string[]): Promise<void> {
    const uniqueUrls = [...new Set(urls)]
    const removableUrls = await this.client.$transaction((tx) => this.findUnreferencedUrls(tx, uniqueUrls))
    await this.removeFiles(removableUrls)
  }

  private async findUnreferencedUrls(client: Prisma.TransactionClient, urls: string[], ignoredVariantId?: string): Promise<string[]> {
    const remaining = await Promise.all(urls.map(async (url) => {
      const counts = await Promise.all([
        client.asset.count({ where: { url } }),
        client.assetVariant.count({ where: { url, ...(ignoredVariantId ? { id: { not: ignoredVariantId } } : {}) } }),
        this.countContentReferences(client, url),
      ])
      return counts.some((count) => count > 0) ? null : url
    }))
    return remaining.filter((url): url is string => url !== null)
  }

  private async countContentReferences(client: Prisma.TransactionClient, url: string): Promise<number> {
    const counts = await Promise.all([
      client.character.count({ where: { defaultSprite: url } }),
      client.sprite.count({ where: { url } }),
      client.project.count({ where: { cover: url } }),
      client.flowNode.count({ where: { data: { contains: url } } }),
      client.storyBible.count({ where: { content: { contains: url } } }),
    ])
    return counts.reduce((total, count) => total + count, 0)
  }

  private async removeFiles(urls: string[]): Promise<void> {
    await Promise.all(urls.map(async (url) => {
      try { await rm(this.pathFromUrl(url), { force: true }) } catch { /* Unsafe or unavailable files remain untouched. */ }
    }))
  }

  private pathFromUrl(url: string): string {
    if (!url.startsWith('/uploads/')) throw new Error('素材路径不安全')
    return safePath(this.storageRoot, url.slice('/uploads/'.length))
  }

  private async requireOwnedAsset(assetId: string, userId: string) {
    const asset = await this.client.asset.findUnique({ where: { id: assetId }, include: { project: { select: { authorId: true } } } })
    if (!asset) throw new Error('素材不存在')
    if (asset.project.authorId !== userId) throw new Error('无权访问此素材')
    return asset
  }

  private async requireOwnedVariant(variantId: string, userId: string) {
    const variant = await this.client.assetVariant.findUnique({ where: { id: variantId }, include: { asset: { include: { project: { select: { authorId: true } } } } } })
    if (!variant) throw new Error('素材产物不存在')
    if (variant.asset.project.authorId !== userId) throw new Error('无权访问此素材产物')
    return variant
  }
}

export const prismaAssetService = new PrismaAssetService()
