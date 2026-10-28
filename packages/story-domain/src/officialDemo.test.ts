import { describe, expect, it } from 'vitest'
import { analyzeStoryGraph, OFFICIAL_DEMO } from './index.js'

describe('official demo graph', () => {
  it('translates every spoken line, caption and choice without changing branch order', () => {
    for (const node of OFFICIAL_DEMO.graph.nodes.filter((node) => ['dialogue', 'subtitle', 'choice'].includes(node.type))) {
      const ja = (node.data.localizations as { ja: { text?: string; choices?: string[]; sourceHash: string } }).ja
      expect(ja.sourceHash).toBeTruthy()
      if (node.type === 'choice') expect(ja.choices?.length).toBe((node.data.choices as string[]).length)
      else expect(ja.text?.trim()).toBeTruthy()
    }
  })
  it('contains nine named and connected scenes', () => {
    const groups = new Set(OFFICIAL_DEMO.graph.nodes.map((node) => node.data.sceneGroupId))
    expect(groups.size).toBe(9)
    expect([...new Set(OFFICIAL_DEMO.graph.nodes.map((node) => node.data.sceneCode))].sort()).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9'])
    expect(OFFICIAL_DEMO.graph.nodes.every((node) => typeof node.data.sceneTitle === 'string' && node.data.sceneTitle.trim())).toBe(true)
    const nodeIds = new Set(OFFICIAL_DEMO.graph.nodes.map((node) => node.id))
    expect(OFFICIAL_DEMO.graph.edges.every((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))).toBe(true)
    expect(analyzeStoryGraph(OFFICIAL_DEMO.graph).issues.filter((issue) => issue.level === 'danger')).toEqual([])
  })

  it('gives every three-way choice an explicit destination handle', () => {
    const choices = OFFICIAL_DEMO.graph.nodes.filter((node) => node.type === 'choice')
    expect(choices.length).toBeGreaterThanOrEqual(2)
    for (const choice of choices) {
      const expected = (choice.data.choices as string[]).map((_, index) => `choice-${index}`)
      const actual = OFFICIAL_DEMO.graph.edges.filter((edge) => edge.source === choice.id).map((edge) => edge.sourceHandle).sort()
      expect(actual).toEqual(expected)
    }
  })

  it('keeps the final choice on three distinct routes with separate endings', () => {
    const finalChoice = OFFICIAL_DEMO.graph.nodes.find((node) => node.id === 's8-choice')
    expect(finalChoice).toBeDefined()

    const routes = ['choice-0', 'choice-1', 'choice-2'].map((handle) => {
      const firstEdge = OFFICIAL_DEMO.graph.edges.find((edge) => edge.source === finalChoice?.id && edge.sourceHandle === handle)
      expect(firstEdge).toBeDefined()
      const route: string[] = []
      let current = firstEdge!.target
      while (current) {
        expect(route).not.toContain(current)
        route.push(current)
        current = OFFICIAL_DEMO.graph.edges.find((edge) => edge.source === current)?.target || ''
      }
      return route
    })

    expect(new Set(routes.map((route) => route.at(-1))).size).toBe(3)
    expect(routes.every((route) => route.length >= 6)).toBe(true)
    expect(routes[0]!.some((id) => id.startsWith('ending-failure-'))).toBe(true)
    expect(routes[1]!.some((id) => id.startsWith('ending-coauthor-'))).toBe(true)
    expect(routes[2]!.some((id) => id.startsWith('ending-agency-'))).toBe(true)

    for (let left = 0; left < routes.length; left += 1) {
      for (let right = left + 1; right < routes.length; right += 1) {
        expect(routes[left]!.filter((id) => routes[right]!.includes(id))).toEqual([])
      }
    }
  })

  it('uses directed dialogue and non-dialogue staging throughout the demo', () => {
    const dialogues = OFFICIAL_DEMO.graph.nodes.filter((node) => node.type === 'dialogue')
    const subtitles = OFFICIAL_DEMO.graph.nodes.filter((node) => node.type === 'subtitle')
    const transitions = OFFICIAL_DEMO.graph.nodes.filter((node) => node.type === 'transition')
    const audioNodes = OFFICIAL_DEMO.graph.nodes.filter((node) => node.data.audio)

    expect(dialogues.length).toBeGreaterThanOrEqual(52)
    expect(dialogues.every((node) => node.data.voiceDirection && typeof node.data.voiceDirection === 'object')).toBe(true)
    expect(subtitles.length).toBeGreaterThanOrEqual(4)
    expect(transitions.length).toBeGreaterThanOrEqual(3)
    expect(audioNodes.length).toBeGreaterThanOrEqual(12)
  })

  it('stores the first choice and pays it off with three conditional echoes', () => {
    const choice = OFFICIAL_DEMO.graph.nodes.find((node) => node.id === 's3-choice')
    expect(choice?.data.effects).toEqual([
      [{ kind: 'setVariable', variable: 'authorStance', value: 'fear' }],
      [{ kind: 'setVariable', variable: 'authorStance', value: 'rewrite' }],
      [{ kind: 'setVariable', variable: 'authorStance', value: 'agency' }],
    ])

    const conditions = OFFICIAL_DEMO.graph.nodes.filter((node) => node.type === 'condition')
    expect(conditions.map((node) => node.data.value)).toEqual(expect.arrayContaining(['fear', 'rewrite']))
    expect(OFFICIAL_DEMO.graph.nodes.some((node) => node.id === 's7-fear-echo')).toBe(true)
    expect(OFFICIAL_DEMO.graph.nodes.some((node) => node.id === 's7-rewrite-echo')).toBe(true)
    expect(OFFICIAL_DEMO.graph.nodes.some((node) => node.id === 's7-agency-echo')).toBe(true)
  })

  it('assigns distinct musical identities and deliberate silence to story beats', () => {
    const bgmUrls = OFFICIAL_DEMO.graph.nodes.flatMap((node) => {
      const audio = node.data.audio as { bgm?: { action?: string; url?: string } } | undefined
      return audio?.bgm?.action === 'play' && audio.bgm.url ? [audio.bgm.url] : []
    })
    expect(new Set(bgmUrls).size).toBeGreaterThanOrEqual(6)
    expect(OFFICIAL_DEMO.graph.nodes.some((node) => {
      const audio = node.data.audio as { bgm?: { action?: string } } | undefined
      return audio?.bgm?.action === 'stop'
    })).toBe(true)
  })
})
