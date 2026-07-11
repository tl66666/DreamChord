import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { processImage, type ImageRecipe } from './imageProcessor.js'

export interface AcceptAssetInput {
  purpose: ImageRecipe['purpose']
  characterId?: string
  characterName?: string
  expressionName?: string
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
      metadata: JSON.stringify({ recipe }),
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
    await this.client.assetVariant.update({ where: { id: variant.id }, data: { status: 'rejected' } })
    await rm(this.pathFromUrl(variant.url), { force: true }).catch(() => undefined)
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
