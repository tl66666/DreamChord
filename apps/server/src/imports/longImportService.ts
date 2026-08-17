import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { calculateImportProgress, splitLongImportText } from './longImportPlan.js'

export type LongImportStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
export interface LongImportChunkDto { id: string; index: number; chapterTitle: string; startOffset: number; endOffset: number; status: string; attempts: number; errorMessage: string | null }
export interface LongImportDto {
  id: string; fileName: string; status: LongImportStatus; chunkSize: number; totalChunks: number; completedChunks: number; failedChunks: number; progress: { total: number; completed: number; failed: number; percent: number }; errorMessage: string | null; createdAt: string; updatedAt: string; completedAt: string | null; chunks?: LongImportChunkDto[]
}

export interface LongImportService {
  create(input: { projectId: string; fileName: string; text: string; chunkSize?: number }, userId: string): Promise<LongImportDto>
  list(projectId: string, userId: string): Promise<LongImportDto[]>
  get(importId: string, userId: string): Promise<LongImportDto>
  pause(importId: string, userId: string): Promise<LongImportDto>
  resume(importId: string, userId: string): Promise<LongImportDto>
  cancel(importId: string, userId: string): Promise<LongImportDto>
  retry(importId: string, userId: string): Promise<LongImportDto>
  result(importId: string, userId: string): Promise<{ importId: string; text: string }>
  recoverInterruptedRuns(): Promise<void>
}
type LongImportWithChunks = Prisma.LongTextImportGetPayload<{ include: { chunks: true } }>

function iso(value: Date): string { return value.toISOString() }

export class PrismaLongImportService implements LongImportService {
  private draining = false
  constructor(private readonly client: PrismaClient = prisma) {}

  async create(input: { projectId: string; fileName: string; text: string; chunkSize?: number }, userId: string): Promise<LongImportDto> {
    await this.requireOwner(input.projectId, userId)
    const chunkSize = Math.min(50_000, Math.max(1_000, Math.floor(input.chunkSize ?? 12_000)))
    const plans = splitLongImportText(input.text, chunkSize)
    if (!input.text.trim() || plans.length === 0) throw new Error('稿件内容不能为空')
    const row = await this.client.longTextImport.create({
      data: {
        projectId: input.projectId, userId, fileName: input.fileName.trim().slice(0, 200) || '未命名稿件', sourceText: input.text,
        chunkSize, totalChunks: plans.length,
        chunks: { create: plans.map((chunk) => ({ index: chunk.index, chapterTitle: chunk.chapterTitle, text: chunk.text, startOffset: chunk.startOffset, endOffset: chunk.endOffset })) },
      }, include: { chunks: { orderBy: { index: 'asc' } } },
    })
    this.wake()
    return this.toDto(row, true)
  }

  async list(projectId: string, userId: string): Promise<LongImportDto[]> {
    await this.requireOwner(projectId, userId)
    const rows = await this.client.longTextImport.findMany({ where: { projectId, userId }, orderBy: { createdAt: 'desc' }, include: { chunks: true } })
    return rows.map((row) => this.toDto(row, false))
  }

  async get(importId: string, userId: string): Promise<LongImportDto> {
    const row = await this.findOwned(importId, userId)
    return this.toDto(row, true)
  }

  async pause(importId: string, userId: string): Promise<LongImportDto> {
    const row = await this.findOwned(importId, userId)
    if (row.status !== 'queued' && row.status !== 'running') throw new Error('任务当前不可暂停')
    await this.client.longTextImport.update({ where: { id: importId }, data: { status: 'paused' } })
    return this.get(importId, userId)
  }

  async resume(importId: string, userId: string): Promise<LongImportDto> {
    const row = await this.findOwned(importId, userId)
    if (row.status !== 'paused') throw new Error('任务当前不可恢复')
    await this.client.longTextImport.update({ where: { id: importId }, data: { status: 'queued', errorMessage: null } })
    this.wake()
    return this.get(importId, userId)
  }

  async cancel(importId: string, userId: string): Promise<LongImportDto> {
    const row = await this.findOwned(importId, userId)
    if (['completed', 'cancelled'].includes(row.status)) throw new Error('任务已经结束')
    await this.client.longTextImport.update({ where: { id: importId }, data: { status: 'cancelled', completedAt: new Date() } })
    return this.get(importId, userId)
  }

  async retry(importId: string, userId: string): Promise<LongImportDto> {
    const row = await this.findOwned(importId, userId)
    if (row.status !== 'failed') throw new Error('只有失败任务可以重试')
    await this.client.$transaction([
      this.client.longTextImportChunk.updateMany({ where: { importId, status: 'failed' }, data: { status: 'queued', errorMessage: null } }),
      this.client.longTextImport.update({ where: { id: importId }, data: { status: 'queued', errorMessage: null, completedAt: null } }),
    ])
    this.wake()
    return this.get(importId, userId)
  }

  async result(importId: string, userId: string): Promise<{ importId: string; text: string }> {
    const row = await this.findOwned(importId, userId)
    if (row.status !== 'completed') throw new Error('任务尚未完成')
    const chunks = await this.client.longTextImportChunk.findMany({ where: { importId }, orderBy: { index: 'asc' }, select: { outputText: true, text: true } })
    return { importId, text: chunks.map((chunk) => chunk.outputText ?? chunk.text).join('\n\n') }
  }

  async recoverInterruptedRuns(): Promise<void> {
    await this.client.longTextImport.updateMany({ where: { status: 'running' }, data: { status: 'queued' } })
    await this.client.longTextImportChunk.updateMany({ where: { status: 'processing' }, data: { status: 'queued' } })
    this.wake()
  }

  private wake(): void { if (!this.draining) void this.drain() }

  private async drain(): Promise<void> {
    if (this.draining) return
    this.draining = true
    try {
      while (true) {
        const job = await this.client.longTextImport.findFirst({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' } })
        if (!job) break
        const claimed = await this.client.longTextImport.updateMany({ where: { id: job.id, status: 'queued' }, data: { status: 'running', errorMessage: null } })
        if (claimed.count !== 1) continue
        await this.process(job.id)
      }
    } finally { this.draining = false }
  }

  private async process(importId: string): Promise<void> {
    try {
      while (true) {
        const job = await this.client.longTextImport.findUnique({ where: { id: importId } })
        if (!job || job.status === 'cancelled' || job.status === 'paused') return
        const chunk = await this.client.longTextImportChunk.findFirst({ where: { importId, status: { in: ['queued', 'processing'] } }, orderBy: { index: 'asc' } })
        if (!chunk) {
          await this.client.longTextImport.update({ where: { id: importId }, data: { status: 'completed', completedAt: new Date(), errorMessage: null } })
          return
        }
        await this.client.longTextImportChunk.update({ where: { id: chunk.id }, data: { status: 'processing', attempts: { increment: 1 }, errorMessage: null } })
        const outputText = chunk.text.replace(/\r\n?/g, '\n').trim()
        if (!outputText) throw new Error(`第 ${chunk.index + 1} 个文本块为空`)
        await this.client.$transaction([
          this.client.longTextImportChunk.update({ where: { id: chunk.id }, data: { status: 'completed', outputText } }),
          this.client.longTextImport.update({ where: { id: importId }, data: { completedChunks: { increment: 1 }, errorMessage: null } }),
        ])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '文本块处理失败'
      await this.client.longTextImport.update({ where: { id: importId }, data: { status: 'failed', errorMessage: message } }).catch(() => undefined)
      await this.client.longTextImportChunk.updateMany({ where: { importId, status: 'processing' }, data: { status: 'failed', errorMessage: message } }).catch(() => undefined)
    }
  }

  private async findOwned(importId: string, userId: string) {
    const row = await this.client.longTextImport.findFirst({ where: { id: importId, userId }, include: { chunks: { orderBy: { index: 'asc' } } } })
    if (!row) throw new Error('导入任务不存在')
    return row
  }

  private async requireOwner(projectId: string, userId: string): Promise<void> {
    const project = await this.client.project.findUnique({ where: { id: projectId }, select: { authorId: true } })
    if (!project) throw new Error('项目不存在')
    if (project.authorId !== userId) throw new Error('无权访问此项目')
  }

  private toDto(row: LongImportWithChunks, includeChunks: boolean): LongImportDto {
    const progress = calculateImportProgress(row.chunks ?? [])
    return {
      id: row.id, fileName: row.fileName, status: row.status as LongImportStatus, chunkSize: row.chunkSize, totalChunks: row.totalChunks,
      completedChunks: progress.completed, failedChunks: progress.failed, progress, errorMessage: row.errorMessage,
      createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), completedAt: row.completedAt ? iso(row.completedAt) : null,
      ...(includeChunks ? { chunks: row.chunks.map((chunk) => ({ id: chunk.id, index: chunk.index, chapterTitle: chunk.chapterTitle, startOffset: chunk.startOffset, endOffset: chunk.endOffset, status: chunk.status, attempts: chunk.attempts, errorMessage: chunk.errorMessage })) } : {}),
    }
  }
}

export const prismaLongImportService = new PrismaLongImportService()
