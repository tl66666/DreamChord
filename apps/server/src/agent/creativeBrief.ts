import type { AgentProjectSnapshot } from './context.js'

export type CreativeMaterialType = 'BACKGROUND' | 'CHARACTER' | 'CG'

export interface CreativeMaterial {
  type: CreativeMaterialType
  name: string
  source?: 'project'
  assetId?: string
  url?: string
  prompt?: string
}

export interface CreativeBrief {
  sourceText: string
  materials: {
    reused: CreativeMaterial[]
    missing: CreativeMaterial[]
  }
  warnings: string[]
}

export function buildCreativeBrief(input: { text: string; snapshot: AgentProjectSnapshot }): CreativeBrief {
  const text = input.text.trim()
  const reused: CreativeMaterial[] = []
  const missing: CreativeMaterial[] = []
  const addReused = (material: CreativeMaterial) => {
    if (!reused.some((item) => item.type === material.type && item.assetId === material.assetId)) reused.push(material)
  }
  const addMissing = (material: CreativeMaterial) => {
    if (!missing.some((item) => item.type === material.type && item.name === material.name)) missing.push(material)
  }

  const backgrounds = input.snapshot.assets.filter((asset) => asset.type === 'BACKGROUND')
  for (const background of backgrounds) {
    if (text.includes(background.name)) addReused({ type: 'BACKGROUND', name: background.name, source: 'project', assetId: background.id, url: background.url })
  }
  const settings = extractLocations(text)
  for (const setting of settings) {
    if (!backgrounds.some((asset) => asset.name === setting)) {
      addMissing({ type: 'BACKGROUND', name: setting, prompt: `${setting}，视觉小说背景，叙事氛围明确，无人物，无文字，16:9，1920x1080` })
    }
  }

  for (const character of input.snapshot.characters) {
    if (text.includes(character.name)) addReused({ type: 'CHARACTER', name: character.name, source: 'project', assetId: character.id })
  }
  for (const name of extractCharacterNames(text)) {
    if (!input.snapshot.characters.some((character) => character.name === name)) {
      addMissing({ type: 'CHARACTER', name, prompt: `${name}，视觉小说角色立绘，半身到全身，正面站姿，表情自然，透明背景 PNG，单人，无文字` })
    }
  }
  if (/(?:关键|一张|生成|需要).*CG|CG.*(?:画面|图|场景|素材)?/i.test(text)) {
    addMissing({ type: 'CG', name: '关键剧情 CG', prompt: `${text.slice(0, 180)}，视觉小说关键 CG，叙事焦点明确，人物关系清晰，无文字，16:9，1920x1080` })
  }

  const warnings = missing.length > 0
    ? ['未精确匹配的素材不会自动套用；可先上传或生成下列素材，再在工作台配置。']
    : []
  return { sourceText: text, materials: { reused, missing }, warnings }
}

export function formatCreativeMaterialPlan(brief: CreativeBrief): string {
  const reused = brief.materials.reused.length > 0
    ? brief.materials.reused.map((item) => `- ${label(item.type)}：${item.name}（复用项目素材）`).join('\n')
    : '- 当前请求没有精确匹配的项目素材。'
  const missing = brief.materials.missing.length > 0
    ? brief.materials.missing.map((item) => `- ${label(item.type)}：${item.name}\n  提示词：${item.prompt}`).join('\n')
    : '- 无需新增素材。'
  return `素材规划（不会修改工作台剧情）：\n\n可复用素材：\n${reused}\n\n缺少素材：\n${missing}${brief.warnings.length ? `\n\n${brief.warnings.join('\n')}` : ''}`
}

function label(type: CreativeMaterialType): string {
  return type === 'BACKGROUND' ? '背景' : type === 'CHARACTER' ? '角色立绘' : 'CG'
}

function extractLocations(text: string): string[] {
  const locations = new Set<string>()
  for (const match of text.matchAll(/(?:在|到|回到)([\u4e00-\u9fa5]{2,8})(?:让|中|里|，|。|，|的)/g)) locations.add(match[1]!)
  for (const match of text.matchAll(/(?:地点|场景)[：:]?\s*([\u4e00-\u9fa5]{2,12})/g)) locations.add(match[1]!)
  return [...locations].filter((value) => !/当前章节|素材库|故事设定/.test(value))
}

function extractCharacterNames(text: string): string[] {
  const names = new Set<string>()
  for (const match of text.matchAll(/(?:让|和|与|等)([\u4e00-\u9fa5]{2,3})(?:出现|独自|在|走来|重逢|说|等待|发现)/g)) names.add(match[1]!)
  for (const match of text.matchAll(/([\u4e00-\u9fa5]{2,3})(?:在|从|说|走来|出现|等待|发现)/g)) names.add(match[1]!)
  return [...names].filter((name) => !['当前章节', '素材库', '故事设定', '夜晚港口', '废弃车站'].includes(name))
}
