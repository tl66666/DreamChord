import { Router, type Request, type Response, type Router as ExpressRouter } from 'express'
import { createProvider, type LLMMessage } from '../llm/providers.js'
import { authenticateToken } from '../middleware/auth.js'

const router: ExpressRouter = Router()

const SYSTEM_PROMPT = `你是一位资深的视觉小说编剧助手。你擅长润色对话、续写剧情、设计分支选项、扩写世界观。
请用中文回答，保持二次元叙事风格，语气自然生动。`

async function callLLM(
  provider: string,
  model: string,
  apiKey: string,
  baseUrl: string | undefined,
  messages: LLMMessage[],
  temperature: number,
  res: Response,
) {
  try {
    if (!apiKey) {
      return res.status(400).json({ error: '未提供 API Key' })
    }

    const llm = createProvider(provider, { apiKey, model, baseUrl })
    const fullMessages = [{ role: 'system' as const, content: SYSTEM_PROMPT }, ...messages]
    const content = await llm.chat(fullMessages, { temperature })
    res.json({ content })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 调用失败'
    console.error('[AI Error]', message)
    res.status(500).json({ error: message })
  }
}

// AI 调用需要登录，避免未认证用户滥用
router.use(authenticateToken)

router.post('/chat', (req: Request, res: Response) => {
  const { provider, model, apiKey, baseUrl, messages, temperature = 0.7 } = req.body

  if (!provider || !model || !apiKey) {
    return res.status(400).json({ error: '缺少 provider / model / apiKey' })
  }

  return callLLM(provider, model, apiKey, baseUrl, messages, temperature, res)
})

router.post('/polish', (req: Request, res: Response) => {
  const { provider, model, apiKey, baseUrl, text, temperature = 0.7, style = '自然生动' } = req.body

  if (!provider || !model || !apiKey || !text) {
    return res.status(400).json({ error: '缺少必要参数' })
  }

  const messages: LLMMessage[] = [
    {
      role: 'user',
      content: `请润色以下视觉小说文本，要求风格「${style}」，保持原意但让表达更优美、更有画面感。只返回润色后的文本，不要解释。\n\n原文：\n${text}`,
    },
  ]

  return callLLM(provider, model, apiKey, baseUrl, messages, temperature, res)
})

router.post('/continue', (req: Request, res: Response) => {
  const { provider, model, apiKey, baseUrl, context, temperature = 0.8 } = req.body

  if (!provider || !model || !apiKey || !context) {
    return res.status(400).json({ error: '缺少必要参数' })
  }

  const messages: LLMMessage[] = [
    {
      role: 'user',
      content: `请根据以下视觉小说上下文，续写下一段剧情。保持原有风格和人物设定，不要重复已有内容，直接返回续写文本。\n\n上下文：\n${context}`,
    },
  ]

  return callLLM(provider, model, apiKey, baseUrl, messages, temperature, res)
})

router.post('/choices', (req: Request, res: Response) => {
  const { provider, model, apiKey, baseUrl, context, count = 3, temperature = 0.9 } = req.body

  if (!provider || !model || !apiKey || !context) {
    return res.status(400).json({ error: '缺少必要参数' })
  }

  const messages: LLMMessage[] = [
    {
      role: 'user',
      content: `请为以下视觉小说剧情设计 ${count} 个分支选项。每个选项要简短（不超过 15 个字），符合二次元叙事风格，能引导出不同剧情走向。只返回选项列表，每行一个，不要编号和解释。\n\n上下文：\n${context}`,
    },
  ]

  return callLLM(provider, model, apiKey, baseUrl, messages, temperature, res)
})

const GENERATE_STORY_PROMPT = `你是 DreamChord Engine 的叙事生成协议层。请将用户的自然语言剧情描述转换成可直接在节点编辑器中渲染的节点图。

输出要求：
- 只返回一个 JSON 对象，不要用 markdown 代码块包裹。
- 节点类型仅允许：background、character、dialogue、choice、subtitle。
- 每个节点必须包含：id（唯一字符串）、type、position（{x,y}）、data（见下方）。
- 节点按剧情顺序排列，y 轴间隔约 120，x 轴保持 0 形成线性流。
- 如果包含 choice 节点，必须在其后生成一个汇合节点并把 choice 连接到它，不要 dangling。

字段约定：
- background.data.backgroundId: 使用简短 kebab-case 场景名，如 bg-classroom、bg-sakura、bg-cafe、bg-starry。
- character.data.characterId: 只能使用 yuki、ren、miya、sora、ghost。
- character.data.action: 固定为 "show"。
- character.data.expression: 可选 normal、smile、surprised、serious、smirk、glitch、curious、happy、warm。
- character.data.position: 可选 left、center、right。
- dialogue.data.role: 说话角色名（与 characterId 对应）。
- dialogue.data.text: 台词内容（中文）。
- choice.data.choices: 字符串数组，2-4 个选项。
- subtitle.data.text: 旁白内容（中文）。

边格式：
{ "id": "e1", "source": "n1", "target": "n2", "animated": true, "label"?: "分支标签" }

请基于项目角色设定和世界观生成剧情，保持事件驱动风格，不要解释世界。`

function extractJson(text: string): unknown {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock?.[1]) {
    return JSON.parse(codeBlock[1])
  }
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1))
  }
  return JSON.parse(text)
}

router.post('/generate-story', async (req: Request, res: Response) => {
  const { provider, model, apiKey, baseUrl, prompt, context = '', temperature = 0.8 } = req.body

  if (!provider || !model || !apiKey || !prompt) {
    return res.status(400).json({ error: '缺少必要参数' })
  }

  try {
    const llm = createProvider(provider, { apiKey, model, baseUrl })
    const messages: LLMMessage[] = [
      {
        role: 'user',
        content: `${GENERATE_STORY_PROMPT}\n\n项目上下文：\n${context || '无'}\n\n用户剧情描述：\n${prompt}`,
      },
    ]
    const content = await llm.chat(messages, { temperature, maxTokens: 4096 })
    const parsed = extractJson(content) as { nodes?: unknown[]; edges?: unknown[] }

    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return res.status(500).json({ error: 'AI 返回的 JSON 格式不正确，缺少 nodes 或 edges' })
    }

    res.json({ nodes: parsed.nodes, edges: parsed.edges })
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成剧情失败'
    console.error('[AI Generate Story Error]', message)
    res.status(500).json({ error: message })
  }
})

export default router
