import { FilePenLine, Plus, Trash2 } from 'lucide-react'
import type { AgentPatchDto } from './agentTypes'

export default function PatchPreview({ patch, onSelectNode }: { patch: AgentPatchDto; onSelectNode: (nodeId: string) => void }) {
  const materials = assignedMaterials(patch.payload.operations)
  const createsScene = createsSceneDraft(patch.payload.operations)
  const groups = [
    { label: '新增节点', ids: patch.diff.addedNodeIds, icon: Plus, tone: 'text-emerald-700 bg-emerald-50' },
    { label: '修改节点', ids: patch.diff.updatedNodeIds, icon: FilePenLine, tone: 'text-amber-700 bg-amber-50' },
    { label: '删除节点', ids: patch.diff.removedNodeIds, icon: Trash2, tone: 'text-red-700 bg-red-50' },
  ]
  return <section className="border-b border-slate-200 px-4 py-3"><h4 className="text-xs font-semibold uppercase text-slate-500">变更预览</h4>{createsScene && <p className="mt-2 border-l-2 border-violet-500 bg-violet-50 px-2.5 py-2 text-[11px] leading-5 text-violet-900">草稿已保存在当前对话，应用后会出现在左侧场景树；选择该场景即可逐卡编辑，或用“续写已选场景”继续创作。</p>}{materials.length > 0 && <div className="mt-2 border-l-2 border-cyan-500 bg-cyan-50 px-2.5 py-2"><p className="text-[11px] font-semibold text-cyan-900">已分配素材</p>{materials.map((material) => <p key={`${material.kind}:${material.id}`} className="mt-0.5 truncate text-[11px] text-cyan-800" title={material.id}>{material.kind}：{material.id}</p>)}</div>}<div className="mt-2 space-y-2">{groups.map(({ label, ids, icon: Icon, tone }) => ids.length > 0 && <div key={label}><div className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold ${tone}`}><Icon className="h-3 w-3" /><span>{label}</span><span aria-label={`${label}数量`}>· {ids.length}</span></div><div className="mt-1 space-y-1">{ids.map((id) => <button key={id} onClick={() => onSelectNode(id)} className="block w-full rounded px-2 py-1 text-left font-mono text-[11px] text-slate-600 hover:bg-slate-100">{id}</button>)}</div></div>)}</div><p className="mt-2 text-[11px] text-slate-500">连线：+{patch.diff.addedEdgeIds.length} / -{patch.diff.removedEdgeIds.length}</p></section>
}

function assignedMaterials(operations: unknown[]): Array<{ kind: '背景' | '角色'; id: string }> {
  const materials: Array<{ kind: '背景' | '角色'; id: string }> = []
  for (const operation of operations) {
    if (!operation || typeof operation !== 'object') continue
    const candidate = operation as { kind?: unknown; node?: { type?: unknown; data?: Record<string, unknown> } }
    if (candidate.kind !== 'addNode' || !candidate.node || typeof candidate.node.data !== 'object') continue
    if (candidate.node.type === 'background' && typeof candidate.node.data.backgroundId === 'string') {
      materials.push({ kind: '背景', id: candidate.node.data.backgroundId })
    }
    if (candidate.node.type === 'character' && typeof candidate.node.data.characterId === 'string') {
      materials.push({ kind: '角色', id: candidate.node.data.characterId })
    }
  }
  return materials.filter((material, index) => materials.findIndex((item) => item.kind === material.kind && item.id === material.id) === index)
}

function createsSceneDraft(operations: unknown[]): boolean {
  return operations.some((operation) => {
    if (!operation || typeof operation !== 'object') return false
    const candidate = operation as { node?: { data?: Record<string, unknown> } }
    return typeof candidate.node?.data?.sceneGroupId === 'string'
  })
}
