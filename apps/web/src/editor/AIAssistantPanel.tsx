import { useEffect, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { Check, FileJson, GitBranch, Info, Loader2, MessageCircle, Plus, Sparkles, Wand2, X } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'
import { getDefaultProvider } from '../lib/aiConfig'
import {
  chatWithAI,
  continueStory,
  generateChoices,
  generateStory,
  polishText,
  type GeneratedEdge,
  type GeneratedNode,
  type ProjectDetail,
} from '../api/client'
import { getNodeData, type ShotCard } from './sceneGraph'

function getApiError(err: unknown, fallback = '操作失败'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    return response?.data?.error || fallback
  }
  return err instanceof Error ? err.message || fallback : fallback
}

type AIMode = 'polish' | 'continue' | 'choices' | 'branchReplies' | 'storyGraph'

const MODES: Array<{ key: AIMode; label: string; desc: string; icon: React.ElementType }> = [
  { key: 'polish', label: '润色当前', desc: '优化当前选中卡片的台词/旁白', icon: Wand2 },
  { key: 'continue', label: '续写剧情', desc: '根据最近剧情生成下一句', icon: MessageCircle },
  { key: 'choices', label: '生成选项', desc: '为当前剧情生成分支选项', icon: GitBranch },
  { key: 'branchReplies', label: '分支回应', desc: '为选项卡生成对应后续剧情', icon: GitBranch },
  { key: 'storyGraph', label: '生成节点图', desc: '按描述生成一段可编辑节点图', icon: FileJson },
]

interface AIAssistantPanelProps {
  project: ProjectDetail | null
  selectedCard: ShotCard | null
  initialMode: AIMode
  onModeChange: (mode: AIMode) => void
  onClose?: () => void
}

export default function AIAssistantPanel({ project, selectedCard, initialMode, onModeChange, onClose }: AIAssistantPanelProps) {
  const { nodes, edges, updateNodeData, setNodes, setEdges } = useEditorStore()
  const [mode, setMode] = useState<AIMode>(initialMode)
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('自然生动')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [generated, setGenerated] = useState<{ nodes: GeneratedNode[]; edges: GeneratedEdge[] } | null>(null)
  const [applied, setApplied] = useState(false)
  const [autoMergeBranches, setAutoMergeBranches] = useState(false)
  const [warning, setWarning] = useState('')

  // 同步外部模式变更（从卡片编辑器请求 AI 时）
  useEffect(() => {
    setMode(initialMode)
    setWarning('')
    setResult('')
  }, [initialMode])

  const provider = getDefaultProvider()

  // 当前卡片的文本节点 ID（用于 applyResult）
  const cardTextNodeId = useMemo(() => {
    if (!selectedCard) return null
    const textNode = selectedCard.nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .find((n) => n && n.type !== 'background' && n.type !== 'character')
    return textNode?.id || null
  }, [selectedCard, nodes])

  // 当前卡片的选项节点 ID
  const cardChoiceNodeId = useMemo(() => {
    if (!selectedCard || selectedCard.type !== 'choice') return null
    return selectedCard.nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .find((n) => n?.type === 'choice')?.id || null
  }, [selectedCard, nodes])

  const recentContext = useMemo(() => {
    return nodes
      .slice(-12)
      .map((node, index) => {
        const data = getNodeData(node)
        if (node.type === 'dialogue') return `${index + 1}. ${data.role || '角色'}：${data.text || ''}`
        if (node.type === 'subtitle') return `${index + 1}. 旁白：${data.text || ''}`
        if (node.type === 'choice') return `${index + 1}. 选项：${(data.choices as string[] | undefined)?.join(' / ') || ''}`
        if (node.type === 'background') return `${index + 1}. 背景：${data.backgroundId || ''}`
        if (node.type === 'character') return `${index + 1}. 角色登场：${data.characterId || ''} ${data.expression || ''}`
        return `${index + 1}. ${node.type}`
      })
      .join('\n')
  }, [nodes])

  const projectContext = useMemo(() => {
    const characters = project?.characters?.map((char) => `- ${char.name}: ${char.description || '暂无简介'}`).join('\n') || '暂无项目角色设定'
    return `项目：${project?.title || '未命名项目'}\n简介：${project?.description || '暂无简介'}\n角色：\n${characters}\n\n最近剧情：\n${recentContext}`
  }, [project, recentContext])

  const handleSetMode = (newMode: AIMode) => {
    setMode(newMode)
    onModeChange(newMode)
    setWarning('')
    setResult('')
  }

  const runAI = async () => {
    setWarning('')
    const cfg = provider
    setLoading(true)
    setResult('')
    setGenerated(null)
    setApplied(false)
    try {
      if (!cfg) {
        runLocalAssistant()
        return
      }
      if (mode === 'polish') {
        if (!selectedCard) {
          setWarning('请先在中栏选中一张镜头卡。')
          return
        }
        if (!selectedCard.text.trim()) {
          setWarning('当前卡片没有文本，请先输入台词或旁白内容。')
          return
        }
        const { content } = await polishText({
          provider: cfg.provider,
          model: cfg.model,
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl,
          text: selectedCard.text,
          style,
        })
        setResult(content.trim())
      }

      if (mode === 'continue') {
        const { content } = await continueStory({
          provider: cfg.provider,
          model: cfg.model,
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl,
          context: `${projectContext}\n\n当前卡片：${selectedCard ? `${selectedCard.speaker}：${selectedCard.text}` : '无选中'}\n\n续写要求：${prompt || '承接上一句，写一个新的对话节点。只返回台词文本。'}`,
        })
        setResult(content.trim())
      }

      if (mode === 'choices') {
        const { content } = await generateChoices({
          provider: cfg.provider,
          model: cfg.model,
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl,
          context: `${projectContext}\n\n当前卡片：${selectedCard ? `${selectedCard.speaker}：${selectedCard.text}` : '未选中'}`,
          count: 3,
        })
        setResult(content.trim())
      }

      if (mode === 'branchReplies') {
        if (!selectedCard || selectedCard.type !== 'choice') {
          setWarning('请先选中一张选项卡（类型为"选项"的镜头卡）。')
          return
        }
        const choices = selectedCard.choices || []
        if (choices.length === 0) {
          setWarning('当前选项卡没有选项内容，请先添加选项。')
          return
        }
        const { content } = await chatWithAI({
          provider: cfg.provider,
          model: cfg.model,
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl,
          temperature: 0.8,
          messages: [
            {
              role: 'user',
              content: `${projectContext}\n\n请为下面每个选项各写一句后续剧情台词，必须一行对应一个选项，不要编号，不要解释。\n选项：\n${choices.join('\n')}`,
            },
          ],
        })
        setResult(content.trim())
      }

      if (mode === 'storyGraph') {
        if (!prompt.trim()) {
          setWarning('请先输入你想生成的剧情描述。')
          return
        }
        const data = await generateStory({
          provider: cfg.provider,
          model: cfg.model,
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl,
          prompt: prompt.trim(),
          context: projectContext,
          temperature: 0.75,
        })
        setGenerated(data)
        setResult(`已生成 ${data.nodes.length} 个节点、${data.edges.length} 条连线。可以点击"插入节点图"放进当前编辑器。`)
      }
    } catch (error: unknown) {
      console.error(error)
      setWarning(getApiError(error, 'AI 调用失败，请检查 API Key、模型名和网络。'))
    } finally {
      setLoading(false)
    }
  }

  const runLocalAssistant = () => {
    if (mode === 'polish') {
      if (!selectedCard) {
        setWarning('请先在中栏选中一张镜头卡。')
        return
      }
      if (!selectedCard.text.trim()) {
        setWarning('当前卡片没有文本，请先输入台词或旁白内容。')
        return
      }
      setResult(selectedCard.text.replace(/。?$/, '。'))
      return
    }
    if (mode === 'continue') {
      setResult(prompt.trim() || '旁白：新的节点亮起，角色终于决定继续向前走。')
      return
    }
    if (mode === 'choices') {
      setResult(['继续追问真相', '先保护眼前的人', '删除这个节点'].join('\n'))
      return
    }
    if (mode === 'branchReplies') {
      if (!selectedCard || selectedCard.type !== 'choice') {
        setWarning('请先选中一张选项卡。')
        return
      }
      const choices = selectedCard.choices || ['继续']
      setResult(choices.map((choice) => `选择"${choice}"后，故事朝着不同的方向展开。`).join('\n'))
      return
    }
    if (mode === 'storyGraph') {
      const graph = createLocalStoryGraph(prompt || '角色发现一个发光节点，并做出第一个选择。')
      setGenerated(graph)
      setResult(`本地生成 ${graph.nodes.length} 个节点、${graph.edges.length} 条连线。配置 AI 后可获得更细腻的文本。`)
    }
  }

  const parseLines = (text: string) =>
    text
      .split('\n')
      .map((line) => line.replace(/^\s*[-*\d.、]+/, '').trim())
      .filter(Boolean)

  const appendNode = (type: string, data: Record<string, unknown>) => {
    const last = nodes[nodes.length - 1]
    const newNode: Node = {
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      position: last ? { x: last.position.x, y: last.position.y + 140 } : { x: 260, y: 160 },
      data,
    }
    const nextNodes = [...nodes, newNode]
    const nextEdges = last
      ? [...edges, { id: `e-${last.id}-${newNode.id}`, source: last.id, target: newNode.id, animated: true } as Edge]
      : edges
    setNodes(nextNodes)
    setEdges(nextEdges)
    setApplied(true)
  }

  const applyResult = () => {
    if (!result) return
    if (mode === 'polish' && cardTextNodeId) {
      updateNodeData(cardTextNodeId, { text: result })
      setApplied(true)
      return
    }
    if (mode === 'choices' && cardChoiceNodeId) {
      updateNodeData(cardChoiceNodeId, { choices: parseLines(result).slice(0, 4) })
      setApplied(true)
      return
    }
    if (mode === 'branchReplies' && cardChoiceNodeId) {
      const choices = selectedCard?.choices || []
      const replies = parseLines(result)
      const baseX = 600
      const baseY = 400
      const newNodes: Node[] = choices.map((choice, index) => ({
        id: `ai-branch-${Date.now()}-${index}`,
        type: 'dialogue',
        position: { x: baseX, y: baseY + index * 150 },
        data: { role: '旁白', text: replies[index] || `沿着"${choice}"继续展开。` },
      }))
      const newEdges: Edge[] = newNodes.map((node, index) => ({
        id: `e-${cardChoiceNodeId}-${node.id}`,
        source: cardChoiceNodeId,
        sourceHandle: `choice-${index}`,
        target: node.id,
        label: choices[index] || `选项 ${index + 1}`,
        animated: true,
      }))
      if (autoMergeBranches) {
        const mergeNode: Node = {
          id: `ai-branch-merge-${Date.now()}`,
          type: 'subtitle',
          position: { x: baseX + 360, y: baseY + Math.max(0, choices.length - 1) * 75 },
          data: { text: '分支在这里重新汇合，继续进入下一段主线。', position: 'bottom', duration: 0 },
        }
        const mergeEdges: Edge[] = newNodes.map((node) => ({
          id: `e-${node.id}-${mergeNode.id}`,
          source: node.id,
          target: mergeNode.id,
          animated: true,
        }))
        setNodes([...nodes, ...newNodes, mergeNode])
        setEdges([...edges.filter((edge) => edge.source !== cardChoiceNodeId), ...newEdges, ...mergeEdges])
      } else {
        setNodes([...nodes, ...newNodes])
        setEdges([...edges.filter((edge) => edge.source !== cardChoiceNodeId), ...newEdges])
      }
      setApplied(true)
      return
    }
    if (mode === 'continue') {
      appendNode('dialogue', { role: '旁白', text: result })
      return
    }
    if (mode === 'storyGraph' && generated) {
      const offsetX = nodes.length ? Math.max(...nodes.map((node) => node.position.x)) + 320 : 260
      const idMap = new Map<string, string>()
      const newNodes: Node[] = generated.nodes.map((node, index) => {
        const id = `ai-graph-${Date.now()}-${index}`
        idMap.set(node.id, id)
        return {
          id,
          type: node.type,
          position: { x: node.position.x + offsetX, y: node.position.y + 120 },
          data: node.data,
        }
      })
      const newEdges: Edge[] = generated.edges
        .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
        .map((edge, index) => ({
          id: `e-ai-graph-${Date.now()}-${index}`,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
          sourceHandle: edge.sourceHandle,
          label: edge.label,
          animated: edge.animated ?? true,
        }))
      setNodes([...nodes, ...newNodes])
      setEdges([...edges, ...newEdges])
      setApplied(true)
    }
  }

  return (
    <aside className="flex w-80 flex-col border-l border-dream-200 bg-white/95 backdrop-blur-sm">
      <div className="border-b border-dream-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-dream-600" />
            <h3 className="font-semibold text-dream-900">AI 创作助手</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-dream-200 p-1.5 text-dream-500 transition hover:bg-dream-100"
              title="关闭面板"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-dream-500">读取当前选中卡片和最近剧情，帮你润色台词、续写剧情、生成选项和分支。</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* 当前卡片信息 */}
        {selectedCard ? (
          <div className="rounded-lg border border-dream-100 bg-dream-50/50 p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-dream-600">
              <Info className="h-3 w-3" />
              <span className="font-medium">当前卡片</span>
              <span className="font-mono text-dream-400">{selectedCard.sceneCode}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-dream-500">
              {selectedCard.type === 'choice'
                ? `选项卡 · ${(selectedCard.choices || []).length} 个选项`
                : `${selectedCard.speaker}：${selectedCard.text || '（空台词）'}`}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700">
            未选中任何镜头卡。请在中栏点击一张卡片，AI 将针对该卡片内容进行润色或生成。
          </div>
        )}

        {!provider && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
            还没有启用 AI，将使用本地规则生成基础内容。到设置页配置 GLM、DeepSeek、Kimi 或 OpenAI 兼容接口后，可获得真实模型辅助。
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {MODES.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => handleSetMode(item.key)}
                className={`rounded-xl border p-2 text-left transition ${
                  mode === item.key ? 'border-dream-500 bg-dream-50 text-dream-800' : 'border-dream-100 text-dream-600 hover:bg-dream-50'
                }`}
                title={item.desc}
              >
                <Icon className="mb-1 h-4 w-4" />
                <div className="text-xs font-semibold">{item.label}</div>
              </button>
            )
          })}
        </div>

        {mode === 'polish' && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-dream-700">润色风格</span>
            <select value={style} onChange={(event) => setStyle(event.target.value)} className="w-full rounded-lg border border-dream-200 px-3 py-2 text-sm">
              <option>自然生动</option>
              <option>悬疑紧张</option>
              <option>温柔治愈</option>
              <option>轻快日常</option>
              <option>视觉小说台词感</option>
            </select>
          </label>
        )}

        {(mode === 'continue' || mode === 'storyGraph') && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-dream-700">{mode === 'storyGraph' ? '剧情描述' : '续写要求'}</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              placeholder={mode === 'storyGraph' ? '例如：雪在雨夜发现旧故事节点，影阻止她删除空，宫用咖啡厅作为现实锚点。' : '例如：让下一句更有悬念，推动角色进入咖啡厅场景。'}
              className="w-full resize-none rounded-lg border border-dream-200 px-3 py-2 text-sm focus:border-dream-500 focus:outline-none"
            />
          </label>
        )}

        {mode === 'branchReplies' && (
          <label className="flex items-start gap-2 rounded-xl border border-dream-100 bg-dream-50/60 p-3 text-xs leading-5 text-dream-700">
            <input
              type="checkbox"
              checked={autoMergeBranches}
              onChange={(event) => setAutoMergeBranches(event.target.checked)}
              className="mt-1 accent-dream-600"
            />
            <span>
              <span className="block font-semibold text-dream-900">生成后自动添加汇合点</span>
              默认关闭。关闭时，每个选项会沿着自己的分支继续发展；需要两条线重新合到一起时再打开。
            </span>
          </label>
        )}

        {warning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700">
            {warning}
          </div>
        )}

        <button
          onClick={runAI}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-dream-600 py-2.5 text-sm font-medium text-white transition hover:bg-dream-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          生成
        </button>

        {result && (
          <div className="rounded-xl border border-dream-200 bg-dream-50/60 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-dream-700">
              AI 结果
              {applied && <Check className="h-4 w-4 text-green-600" />}
            </div>
            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-dream-800">{result}</div>
            <div className="mt-3 flex gap-2">
              <button onClick={applyResult} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-dream-600 py-1.5 text-xs text-white hover:bg-dream-700">
                <Plus className="h-3.5 w-3.5" />
                应用到编辑器
              </button>
              <button onClick={() => { setResult(''); setGenerated(null); setApplied(false) }} className="rounded-lg border border-dream-200 px-3 py-1.5 text-xs text-dream-600 hover:bg-white">
                清空
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-dream-100 p-3 text-xs text-dream-500">
        {provider ? `当前模型：${provider.name} / ${provider.model}` : '本地辅助模式'}
      </div>
    </aside>
  )
}

function createLocalStoryGraph(prompt: string): { nodes: GeneratedNode[]; edges: GeneratedEdge[] } {
  return {
    nodes: [
      { id: 'n1', type: 'subtitle', position: { x: 0, y: 0 }, data: { text: prompt, position: 'bottom', duration: 0 } },
      { id: 'n2', type: 'dialogue', position: { x: 0, y: 140 }, data: { role: 'yuki', text: '如果这是一个节点，那我应该能选择接下来发生什么。' } },
      { id: 'n3', type: 'choice', position: { x: 0, y: 280 }, data: { choices: ['靠近节点', '先观察四周'] } },
      { id: 'n4', type: 'dialogue', position: { x: 360, y: 220 }, data: { role: '旁白', text: '她靠近节点，光线像回应一样亮了起来。' } },
      { id: 'n5', type: 'dialogue', position: { x: 360, y: 380 }, data: { role: '旁白', text: '她停下脚步，发现旁边还有一条被隐藏的连线。' } },
      { id: 'n6', type: 'subtitle', position: { x: 720, y: 300 }, data: { text: '两个选择汇合成新的主线。', position: 'bottom', duration: 0 } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', sourceHandle: 'choice-0', target: 'n4', label: '靠近节点', animated: true },
      { id: 'e4', source: 'n3', sourceHandle: 'choice-1', target: 'n5', label: '先观察四周', animated: true },
      { id: 'e5', source: 'n4', target: 'n6', animated: true },
      { id: 'e6', source: 'n5', target: 'n6', animated: true },
    ],
  }
}
