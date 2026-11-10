/** Create one private, unvoiced review copy; never change the published book. */
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { makePreviewGraph } from './paint-chapter-five-preview.mjs'

const root = resolve(import.meta.dirname, '..')
const server = resolve(root, 'apps/server')
const require = createRequire(resolve(server, 'package.json'))
require('dotenv').config({ path: resolve(server, '.env') })
const { PrismaClient } = require('@prisma/client')
const client = new PrismaClient()
const id = 'dreamchord-paint-five-private-preview'
try {
  const owner = await client.user.findUniqueOrThrow({ where: { username: 'demo' }, select: { id: true } })
  const graph = makePreviewGraph(await readFile(resolve(root, 'docs/story/paint/05-letter-draft.zh.md'), 'utf8'))
  const result = await client.$transaction(async tx => {
    const existing = await tx.project.findUnique({ where: { id }, select: { id: true, authorId: true, isPublic: true, title: true } })
    if (existing) throw new Error('预览项目已存在；为保护已有修改，未覆盖。')
    return tx.project.create({ data: {
      id, authorId: owner.id, title: '第五章试玩草稿 · 信抵达之前',
      description: '私有中文试玩草稿：复用已有背景，暂未制作角色演出、日语与配音；选择会改变本章后续。',
      cover: '/assets/paint-chapter-four/commission-desk.webp', isPublic: false, isPublished: false,
      chapters: { create: { title: '第五章 · 信抵达之前（试玩草稿）', order: 0,
        nodes: { create: graph.nodes.map(node => ({ nodeId: node.id, type: node.type, positionX: node.position.x, positionY: node.position.y, data: JSON.stringify(node.data) })) },
        edges: { create: graph.edges.map(edge => ({ edgeId: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, animated: edge.animated })) },
      } },
    }, select: { id: true, title: true } })
  })
  console.log(JSON.stringify({ ...result, nodes: graph.nodes.length, edges: graph.edges.length, private: true }))
} finally { await client.$disconnect() }
