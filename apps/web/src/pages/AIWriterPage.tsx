import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, Clipboard, Loader2, Save, Settings, Sparkles, Trash2 } from 'lucide-react'
import { chatWithAI } from '../api/client'
import { getDefaultProvider, resolveBaseUrl } from '../lib/aiConfig'

type WriterMode = 'outline' | 'continue' | 'dialogue' | 'choices' | 'nodeDraft'

interface WriterDraft {
  id: string
  title: string
  content: string
  createdAt: string
}

const DRAFT_KEY = 'dreamchord_ai_writer_drafts_v1'

const modes: { id: WriterMode; label: string; desc: string }[] = [
  { id: 'outline', label: '整理大纲', desc: '把模糊想法整理成起承转合和关键冲突' },
  { id: 'continue', label: '场景续写', desc: '根据上下文补旁白、动作和过渡' },
  { id: 'dialogue', label: '角色台词', desc: '生成符合角色动机的对话' },
  { id: 'choices', label: '选项分支', desc: '设计选项以及每个选项的独立后续' },
  { id: 'nodeDraft', label: '节点草稿', desc: '输出可直接拆进工作台的节点清单' },
]

export default function AIWriterPage() {
  const navigate = useNavigate()
  const provider = useMemo(() => getDefaultProvider(), [])
  const [mode, setMode] = useState<WriterMode>('choices')
  const [role, setRole] = useState('雪')
  const [context, setContext] = useState('雪在樱花坡道上第一次看见发光节点，影突然出现，宫还不知道世界被改写。')
  const [instruction, setInstruction] = useState('设计一个“相信影 / 去找宫确认 / 触碰空白节点”的三分支选择，并让每条分支进入不同剧情。')
  const [result, setResult] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [drafts, setDrafts] = useState<WriterDraft[]>(() => loadDrafts())

  const runWriter = async () => {
    setLoading(true)
    setNotice('')
    const localResult = buildLocalResult(mode, role, context, instruction)
    try {
      if (!provider) {
        setResult(localResult)
        setNotice('当前使用本地辅助模式。配置 API 后，这里会调用真实模型。')
        return
      }

      const response = await chatWithAI({
        provider: provider.provider,
        model: provider.model,
        apiKey: provider.apiKey,
        baseUrl: resolveBaseUrl(provider.provider, provider.baseUrl),
        temperature: 0.72,
        messages: [
          {
            role: 'user',
            content: buildPrompt(mode, role, context, instruction),
          },
        ],
      })
      setResult(response.content)
      setNotice(`已使用 ${provider.name} · ${provider.model} 生成。`)
    } catch (err) {
      console.error(err)
      setResult(localResult)
      setNotice('真实 AI 调用失败，已自动切换为本地辅助草稿，保证你可以继续写。')
    } finally {
      setLoading(false)
    }
  }

  const saveDraft = () => {
    if (!result.trim()) return
    const draft: WriterDraft = {
      id: crypto.randomUUID(),
      title: `${modes.find((item) => item.id === mode)?.label || 'AI 草稿'} · ${new Date().toLocaleString()}`,
      content: result,
      createdAt: new Date().toISOString(),
    }
    const nextDrafts = [draft, ...drafts]
    setDrafts(nextDrafts)
    localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDrafts))
  }

  const deleteDraft = (id: string) => {
    const nextDrafts = drafts.filter((draft) => draft.id !== id)
    setDrafts(nextDrafts)
    localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDrafts))
  }

  const copyResult = async () => {
    if (!result.trim()) return
    await navigator.clipboard.writeText(result)
    setNotice('已复制到剪贴板，可以粘贴进故事节点。')
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/assets/logo.png" alt="DreamChord" className="h-9 w-9 rounded-lg" />
            <div>
              <p className="text-sm font-semibold text-slate-500">DreamChord</p>
              <h1 className="text-xl font-bold text-slate-950">AI 写作辅助台</h1>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/library')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              素材库
            </button>
            <button onClick={() => navigate('/settings')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Settings className="h-4 w-4" />
              模型设置
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-dream-50 px-3 py-1 text-xs font-medium text-dream-700">
                <Bot className="h-3.5 w-3.5" />
                {provider ? `${provider.name} · ${provider.model}` : '本地辅助模式'}
              </div>
              <h2 className="text-2xl font-bold text-slate-950">把“想法”变成能放进节点的剧情</h2>
              <p className="mt-1 text-sm text-slate-600">选择写作任务，输入上下文，生成后可以复制、保存草稿，再放入工作台节点。</p>
            </div>
            <button onClick={runWriter} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-dream-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-dream-700 disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              生成
            </button>
          </div>

          <div className="mb-5 grid gap-2 md:grid-cols-5">
            {modes.map((item) => (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                className={`rounded-lg border px-3 py-3 text-left ${
                  mode === item.id ? 'border-dream-300 bg-dream-50 text-dream-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs leading-5 opacity-80">{item.desc}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">聚焦角色</span>
              <select value={role} onChange={(event) => setRole(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                <option>雪</option>
                <option>影</option>
                <option>宫</option>
                <option>空</option>
                <option>系统幽灵</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">当前剧情上下文</span>
              <textarea value={context} onChange={(event) => setContext(event.target.value)} rows={5} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-6" />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">这次希望 AI 帮什么</span>
            <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={4} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-6" />
          </label>

          {notice && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}

          <div className="mt-5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="font-semibold text-slate-950">生成结果</h3>
              <div className="flex gap-2">
                <button onClick={copyResult} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  <Clipboard className="h-4 w-4" />
                  复制
                </button>
                <button onClick={saveDraft} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
                  <Save className="h-4 w-4" />
                  保存草稿
                </button>
              </div>
            </div>
            <pre className="min-h-[260px] whitespace-pre-wrap p-4 text-sm leading-7 text-slate-800">{result || '生成结果会出现在这里。建议先用“选项分支”检查每个选择是否真的通向不同后续。'}</pre>
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-lg font-bold text-slate-950">草稿箱</h2>
          <p className="mb-4 text-sm text-slate-600">保存好的片段可随时复制到编辑器节点。</p>
          <div className="space-y-3">
            {drafts.map((draft) => (
              <article key={draft.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{draft.title}</h3>
                  <button onClick={() => deleteDraft(draft.id)} className="rounded-md p-1 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="line-clamp-5 whitespace-pre-wrap text-xs leading-5 text-slate-600">{draft.content}</p>
                <button onClick={() => navigator.clipboard.writeText(draft.content)} className="mt-3 text-xs font-medium text-dream-700 hover:text-dream-600">
                  复制这份草稿
                </button>
              </article>
            ))}
            {drafts.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">还没有保存草稿。</div>}
          </div>
        </aside>
      </div>
    </main>
  )
}

function buildPrompt(mode: WriterMode, role: string, context: string, instruction: string) {
  const modeLabel = modes.find((item) => item.id === mode)?.label || '写作辅助'
  return [
    '你是 DreamChord 视觉小说项目的编剧助手。',
    '故事核心：女高中生雪能看见故事节点；影来自被删除的旧版本世界；宫是现实锚点；空是未初始化角色。',
    `任务类型：${modeLabel}`,
    `聚焦角色：${role}`,
    `当前上下文：${context}`,
    `用户要求：${instruction}`,
    '请输出中文，剧情要清楚、有旁白、有行动、有因果。若生成选项，必须写明每个选项对应的独立后续，不要让所有选项回到同一段。',
  ].join('\n')
}

function buildLocalResult(mode: WriterMode, role: string, context: string, instruction: string) {
  if (mode === 'choices') {
    return `选项节点：雪站在发光节点前，必须决定先相信谁。

选项 A：相信影，跟他进入旧版本街道
后续剧情：影带雪穿过一条没有行人的坡道。路牌、店名、樱花树的位置都和现实相同，只有宫的座位是空的。影告诉雪：“这里不是过去，是你们那条线被覆盖前的备份。”雪第一次意识到，所谓删除不是消失，而是被迫留在没人会抵达的分支里。

选项 B：回去找宫确认现实
后续剧情：雪冲进咖啡店，宫正在替她占座。雪问今天是否发生过奇怪的事，宫没有看见节点，却拿出一张便签：“我不知道为什么写下这句话，但我觉得你会需要它。”便签上只有一句：不要让所有选择通向同一个结局。

选项 C：触碰空白节点
后续剧情：雪的指尖碰到没有标题的节点，周围声音瞬间消失。一个透明的孩子从光里醒来，笑着问她：“我应该叫什么名字？”系统幽灵弹出警告：未初始化角色已进入主线。`
  }

  if (mode === 'nodeDraft') {
    return `节点 1｜旁白｜背景：樱花坡道
${context}

节点 2｜角色：${role}
${instruction}

节点 3｜选项
- 相信影 -> 旧版本街道节点
- 找宫确认 -> 咖啡店现实锚点节点
- 触碰空白节点 -> 空的登场节点

节点 4A｜影线
影解释“被删除的人”仍会留下残响，雪开始怀疑自己以前修改过什么。

节点 4B｜宫线
宫虽然看不见节点，却能记住违和感，她成为雪验证现实的锚点。

节点 4C｜空线
空从未命名节点中醒来，故事系统开始出现新的变量。`
  }

  if (mode === 'dialogue') {
    return `雪：“如果这些线真的能改写下一秒，那我以前是不是也删掉过什么？”
影：“你删掉的不是文字，是一个还能呼吸的世界。”
宫：“我听不懂你们说的节点，但我知道一件事。雪，你现在很害怕。”
空：“害怕也可以写进去吗？如果写进去，我是不是就更像一个人？”`
  }

  if (mode === 'outline') {
    return `第一幕：雪发现节点，影出现，世界规则被抛出。
第二幕：雪分别验证影、宫、空三条线，确认“删除”会留下残响。
第三幕：系统幽灵提示主线冲突，雪必须选择修复世界还是保留被删除的人。
结尾钩子：雪发现真正的第一个删除者不是自己，而是 DreamChord 仍未公开的旧版本编辑器。`
  }

  return `雪没有立刻回答。她看着空气中微微闪烁的连线，忽然明白那些并不是命运给她的捷径，而是每一个人被认真对待的可能。

她向前一步，先把手从节点上收回来。

“我不会再乱删任何东西了。”雪说，“但我也不会假装没看见你们。”

影的神情第一次松动。宫站在店门口，手里攥着那张写着陌生字迹的便签。空躲在半透明的光里，像等一个名字，也像等一句允许她存在的台词。`
}

function loadDrafts(): WriterDraft[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WriterDraft[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
