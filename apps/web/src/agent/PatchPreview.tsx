import { FilePenLine, Plus, Trash2 } from 'lucide-react'
import type { AgentPatchDto } from './agentTypes'

export default function PatchPreview({ patch, onSelectNode }: { patch: AgentPatchDto; onSelectNode: (nodeId: string) => void }) {
  const groups = [
    { label: '新增节点', ids: patch.diff.addedNodeIds, icon: Plus, tone: 'text-emerald-700 bg-emerald-50' },
    { label: '修改节点', ids: patch.diff.updatedNodeIds, icon: FilePenLine, tone: 'text-amber-700 bg-amber-50' },
    { label: '删除节点', ids: patch.diff.removedNodeIds, icon: Trash2, tone: 'text-red-700 bg-red-50' },
  ]
  return <section className="border-b border-slate-200 px-4 py-3"><h4 className="text-xs font-semibold uppercase text-slate-500">变更预览</h4><div className="mt-2 space-y-2">{groups.map(({ label, ids, icon: Icon, tone }) => ids.length > 0 && <div key={label}><div className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold ${tone}`}><Icon className="h-3 w-3" /><span>{label}</span><span aria-label={`${label}数量`}>· {ids.length}</span></div><div className="mt-1 space-y-1">{ids.map((id) => <button key={id} onClick={() => onSelectNode(id)} className="block w-full rounded px-2 py-1 text-left font-mono text-[11px] text-slate-600 hover:bg-slate-100">{id}</button>)}</div></div>)}</div><p className="mt-2 text-[11px] text-slate-500">连线：+{patch.diff.addedEdgeIds.length} / -{patch.diff.removedEdgeIds.length}</p></section>
}
