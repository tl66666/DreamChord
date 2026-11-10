import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { makePreviewGraph } from './paint-chapter-five-preview.mjs'

test('each preview choice reaches its own consequence and the shared ending', async () => {
  const graph = makePreviewGraph(await readFile(new URL('../docs/story/paint/05-letter-draft.zh.md', import.meta.url), 'utf8'))
  const byId = new Map(graph.nodes.map(node => [node.id, node]))
  assert.equal(byId.size, graph.nodes.length)
  for (const node of graph.nodes.filter(node => node.type === 'background')) await access(new URL(`../apps/web/public${node.data.backgroundId}`, import.meta.url))
  const choice = graph.nodes.find(node => node.type === 'choice')
  assert.equal(graph.nodes.filter(node => node.type === 'choice').length, 1)
  assert.deepEqual(choice.data.effects.map(effect => effect[0].value), ['paper', 'card'])
  const paths = [0, 1].map(index => {
    let id = graph.edges.find(edge => edge.source === choice.id && edge.sourceHandle === `choice-${index}`).target
    const visited = []
    while (id) {
      assert.ok(byId.has(id), id)
      assert.ok(!visited.includes(id), 'unexpected loop')
      visited.push(id)
      id = graph.edges.find(edge => edge.source === id)?.target
    }
    return visited
  })
  const text = path => path.map(id => byId.get(id).data.text || '').join('\n')
  assert.match(text(paths[0]), /拿回稿/)
  assert.doesNotMatch(text(paths[0]), /接过卡片/)
  assert.match(text(paths[1]), /接过卡片/)
  assert.doesNotMatch(text(paths[1]), /拿回稿/)
  assert.equal(paths[0].at(-1), paths[1].at(-1))
  const reachable = new Set([graph.nodes[0].id, choice.id, ...paths.flat(), ...graph.nodes.slice(0, graph.nodes.findIndex(node => node.id === choice.id)).map(node => node.id)])
  assert.equal(reachable.size, graph.nodes.length)
})
