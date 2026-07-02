import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Node } from '@xyflow/react'
import { BookOpen, Check, FileType, Image, Music, Pencil, RefreshCw, Search, Trash2, Upload, User, X } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'
import { useToast, useConfirm } from '../components/FeedbackProvider'
import { deleteAsset, getProjectAssets, renameAsset, replaceAssetFile, uploadAsset, type Asset } from '../api/client'
import { loadLibraryCharacters, loadLibraryScenes } from '../lib/libraryData'
import { getNodeData } from './sceneGraph'

function getApiError(err: unknown, fallback = '操作失败'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    return response?.data?.error || fallback
  }
  return err instanceof Error ? err.message || fallback : fallback
}

const TYPE_TABS = [
  { key: 'BACKGROUND', label: '背景', icon: Image, accept: 'image/*' },
  { key: 'CG', label: '角色/CG', icon: Image, accept: 'image/*' },
  { key: 'BGM', label: '音乐', icon: Music, accept: 'audio/*' },
  { key: 'OTHER', label: '其他', icon: FileType, accept: '*' },
  { key: 'SETTING', label: '设定', icon: BookOpen, accept: '*' },
]

export default function AssetPanel({
  onSelect,
  selectedType,
  onClose,
}: {
  onSelect?: (asset: Asset) => void
  selectedType?: string
  onClose?: () => void
}) {
  const { project, nodes } = useEditorStore()
  const toast = useToast()
  const confirm = useConfirm()
  const [assets, setAssets] = useState<Asset[]>([])
  const [activeType, setActiveType] = useState(selectedType || 'BACKGROUND')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [replaceTarget, setReplaceTarget] = useState<Asset | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const activeTab = TYPE_TABS.find((tab) => tab.key === activeType) || TYPE_TABS[0]

  useEffect(() => {
    if (selectedType) setActiveType(selectedType)
  }, [selectedType])

  useEffect(() => {
    if (!project?.id) return
    void loadAssets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  const loadAssets = async () => {
    if (!project?.id) return
    setLoading(true)
    try {
      setAssets(await getProjectAssets(project.id))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const libraryScenes = useMemo(() => loadLibraryScenes(), [])
  const libraryCharacters = useMemo(() => loadLibraryCharacters(), [])
  const [showLibrary, setShowLibrary] = useState(true)

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const typeOk = asset.type === activeType
      const queryOk = !query.trim() || asset.name.toLowerCase().includes(query.trim().toLowerCase())
      return typeOk && queryOk
    })
  }, [activeType, assets, query])

  const filteredLibraryScenes = useMemo(() => {
    if (!query.trim()) return libraryScenes
    return libraryScenes.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
  }, [libraryScenes, query])

  const filteredLibraryCharacters = useMemo(() => {
    if (!query.trim()) return libraryCharacters
    return libraryCharacters.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
  }, [libraryCharacters, query])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !project?.id) return
    setUploading(true)
    try {
      if (activeType === 'SETTING') return
      await uploadAsset(project.id, file, activeType)
      await loadAssets()
    } catch (err: unknown) {
      toast.error(getApiError(err, '上传失败'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleReplace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !replaceTarget) return
    setUploading(true)
    try {
      await replaceAssetFile(replaceTarget.id, file, { name: replaceTarget.name, type: replaceTarget.type })
      await loadAssets()
    } catch (err: unknown) {
      toast.error(getApiError(err, '替换失败'))
    } finally {
      setUploading(false)
      setReplaceTarget(null)
      if (replaceInputRef.current) replaceInputRef.current.value = ''
    }
  }

  const confirmRename = async (assetId: string) => {
    const name = editingName.trim()
    if (!name) return
    try {
      const updated = await renameAsset(assetId, name)
      setAssets((prev) => prev.map((asset) => (asset.id === assetId ? updated : asset)))
      setEditingId(null)
      setEditingName('')
    } catch (err: unknown) {
      toast.error(getApiError(err, '重命名失败'))
    }
  }

  const handleDelete = async (asset: Asset) => {
    if (!await confirm({ message: `确定删除素材「${asset.name}」吗？已使用它的节点可能需要重新选择素材。`, danger: true })) return
    try {
      await deleteAsset(asset.id)
      setAssets((prev) => prev.filter((item) => item.id !== asset.id))
    } catch (err: unknown) {
      toast.error(getApiError(err, '删除失败'))
    }
  }

  return (
    <aside className="flex w-80 flex-col border-l border-dream-200 bg-white/95 backdrop-blur-sm">
      <div className="border-b border-dream-100 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-dream-900">素材库</h3>
            <p className="text-xs text-dream-500">上传、选择、重命名、替换、删除项目素材。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !project?.id || activeType === 'SETTING'}
              className="inline-flex items-center gap-1 rounded-lg bg-dream-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-dream-700 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? '处理中' : '上传'}
            </button>
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
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-dream-300" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索素材名"
            className="w-full rounded-lg border border-dream-200 py-2 pl-8 pr-3 text-sm focus:border-dream-500 focus:outline-none"
          />
        </div>
        <input ref={fileInputRef} type="file" accept={activeTab.accept} className="hidden" onChange={handleUpload} />
        <input ref={replaceInputRef} type="file" accept={activeTab.accept} className="hidden" onChange={handleReplace} />
      </div>

      <div className="grid grid-cols-5 gap-1 border-b border-dream-100 p-3">
        {TYPE_TABS.map((tab) => {
          const Icon = tab.icon
          const count = assets.filter((asset) => asset.type === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveType(tab.key)}
              className={`rounded-lg px-1.5 py-2 text-xs transition ${
                activeType === tab.key ? 'bg-dream-100 text-dream-700' : 'text-dream-500 hover:bg-dream-50'
              }`}
            >
              <Icon className="mx-auto mb-1 h-4 w-4" />
              <span className="block truncate">{tab.label}</span>
              <span className="text-[10px] opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeType === 'SETTING' ? (
          <SettingLibrary nodes={nodes} />
        ) : loading ? (
          <p className="text-center text-sm text-dream-500">加载中...</p>
        ) : (
          <>
            {/* 内置素材库 */}
            {showLibrary && (activeType === 'BACKGROUND' || activeType === 'CG') && (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-dream-700">
                    <BookOpen className="h-3.5 w-3.5" />
                    内置{activeType === 'BACKGROUND' ? '背景' : '角色'}素材
                  </h4>
                  <button
                    onClick={() => setShowLibrary(false)}
                    className="text-xs text-dream-400 hover:text-dream-600"
                  >
                    收起
                  </button>
                </div>
                {activeType === 'BACKGROUND' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredLibraryScenes.map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => onSelect?.({ id: scene.id, name: scene.name, url: scene.url, type: 'BACKGROUND' } as Asset)}
                        className="group overflow-hidden rounded-lg border border-dream-100 bg-white text-left transition hover:border-dream-300 hover:shadow-sm"
                      >
                        <div className="relative h-20 w-full overflow-hidden">
                          <img src={scene.url} alt={scene.name} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                        </div>
                        <div className="p-1.5">
                          <p className="truncate text-xs font-medium text-dream-700">{scene.name}</p>
                          <p className="truncate text-[10px] text-dream-400">{scene.usage}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredLibraryCharacters.map((char) => (
                      <button
                        key={char.id}
                        onClick={() => onSelect?.({ id: char.id, name: char.name, url: char.expressions[0]?.url || '', type: 'CG' } as Asset)}
                        className="group overflow-hidden rounded-lg border border-dream-100 bg-white text-left transition hover:border-dream-300 hover:shadow-sm"
                      >
                        <div className="relative h-24 w-full overflow-hidden bg-dream-50">
                          <img src={char.expressions[0]?.url} alt={char.name} className="h-full w-full object-contain" />
                        </div>
                        <div className="p-1.5">
                          <p className="truncate text-xs font-medium text-dream-700">{char.name}</p>
                          <p className="truncate text-[10px] text-dream-400">{char.role} · {char.expressions.length} 表情</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!showLibrary && (activeType === 'BACKGROUND' || activeType === 'CG') && (
              <button
                onClick={() => setShowLibrary(true)}
                className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dream-100 bg-dream-50 py-2 text-xs text-dream-600 hover:bg-dream-100"
              >
                <BookOpen className="h-3.5 w-3.5" />
                展开内置素材
              </button>
            )}

            {/* 上传素材 */}
            <div className="mb-2 flex items-center gap-1.5">
              <h4 className="text-xs font-semibold text-dream-700">项目上传素材</h4>
              <span className="text-[10px] text-dream-400">{filteredAssets.length} 个</span>
            </div>
            {filteredAssets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-dream-200 p-6 text-center">
                <p className="text-sm text-dream-500">暂无上传的{activeTab.label}素材</p>
                <p className="mt-1 text-xs text-dream-400">点击右上角上传按钮添加</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    editing={editingId === asset.id}
                    editingName={editingName}
                    onEditingNameChange={setEditingName}
                    onSelect={() => onSelect?.(asset)}
                    onRenameStart={() => {
                      setEditingId(asset.id)
                      setEditingName(asset.name)
                    }}
                    onRenameCancel={() => {
                      setEditingId(null)
                      setEditingName('')
                    }}
                    onRenameConfirm={() => confirmRename(asset.id)}
                    onReplace={() => {
                      setReplaceTarget(asset)
                      replaceInputRef.current?.click()
                    }}
                    onDelete={() => handleDelete(asset)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

function SettingLibrary({ nodes }: { nodes: Node[] }) {
  const characters = loadLibraryCharacters()
  const scenes = loadLibraryScenes()
  const storyNodes = nodes.filter((node) => ['dialogue', 'subtitle', 'choice', 'background', 'character'].includes(node.type || ''))

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-dream-100 bg-dream-50/70 p-3 text-xs leading-5 text-dream-700">
        <p className="font-semibold text-dream-900">这里是当前项目可用素材总览</p>
        <p className="mt-1">要编辑角色小传、场景说明、剧情模板，请进入完整素材库；回到场景编辑后可直接在背景、角色、对话和选项镜头卡里选用。</p>
        <Link to="/library" className="mt-2 inline-flex rounded-lg bg-dream-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-dream-700">
          打开完整素材库
        </Link>
      </div>

      <section>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-dream-900">
          <User className="h-4 w-4" />
          角色设定
        </h4>
        <div className="space-y-2">
          {characters.map((character) => (
            <div key={character.id} className="rounded-xl border border-dream-100 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-dream-800">{character.name}</span>
                <span className="text-xs text-dream-400">{character.role}</span>
              </div>
              <p className="mt-1 text-xs text-dream-500">立绘：{character.expressions.map((item) => item.label).join(' / ')}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-dream-500">{character.biography}</p>
              <p className="mt-1 text-xs text-dream-500">主题色：{character.color}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-dream-900">
          <Image className="h-4 w-4" />
          背景设定
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {scenes.map((scene) => (
            <div key={scene.id} className="overflow-hidden rounded-xl border border-dream-100 bg-white">
              <img src={scene.url} alt={scene.name} className="h-20 w-full object-cover" />
              <div className="p-2">
                <p className="text-xs font-medium text-dream-700">{scene.name}</p>
                <p className="line-clamp-2 text-[11px] text-dream-400">{scene.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-dream-900">
          <BookOpen className="h-4 w-4" />
          当前剧情素材
        </h4>
        <div className="space-y-2">
          {storyNodes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-dream-200 p-4 text-center text-xs text-dream-500">
              还没有剧情节点。先在场景编辑里添加对话、旁白或选项。
            </p>
          ) : (
            storyNodes.slice(0, 12).map((node, index) => {
              const data = getNodeData(node)
              const summary =
                node.type === 'choice'
                  ? ((data.choices as string[] | undefined) || []).join(' / ')
                  : String(data.text || data.backgroundId || data.characterId || '')
              return (
                <div key={node.id} className="rounded-xl border border-dream-100 bg-white p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-dream-700">{index + 1}. {node.type}</span>
                    <span className="text-[10px] text-dream-300">{node.id}</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-dream-500">{summary || '暂无内容'}</p>
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}

function AssetCard({
  asset,
  editing,
  editingName,
  onEditingNameChange,
  onSelect,
  onRenameStart,
  onRenameCancel,
  onRenameConfirm,
  onReplace,
  onDelete,
}: {
  asset: Asset
  editing: boolean
  editingName: string
  onEditingNameChange: (value: string) => void
  onSelect: () => void
  onRenameStart: () => void
  onRenameCancel: () => void
  onRenameConfirm: () => void
  onReplace: () => void
  onDelete: () => void
}) {
  const isAudio = asset.type === 'BGM'
  return (
    <div className="group overflow-hidden rounded-xl border border-dream-100 bg-dream-50 transition hover:border-dream-300 hover:shadow-sm">
      <button onClick={onSelect} className="block w-full text-left">
        {isAudio ? (
          <div className="flex h-24 items-center justify-center bg-white">
            <Music className="h-9 w-9 text-dream-400" />
          </div>
        ) : (
          <img src={asset.url} alt={asset.name} className="h-24 w-full object-cover" />
        )}
      </button>

      <div className="p-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              value={editingName}
              onChange={(event) => onEditingNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onRenameConfirm()
                if (event.key === 'Escape') onRenameCancel()
              }}
              className="min-w-0 flex-1 rounded border border-dream-200 px-1.5 py-0.5 text-xs"
              autoFocus
            />
            <button onClick={onRenameConfirm} className="rounded p-1 text-green-600 hover:bg-green-50">
              <Check className="h-3 w-3" />
            </button>
            <button onClick={onRenameCancel} className="rounded p-1 text-dream-500 hover:bg-white">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            <p className="truncate text-xs font-medium text-dream-800" title={asset.name}>{asset.name}</p>
            <div className="mt-2 flex items-center gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
              <button onClick={onRenameStart} title="重命名" className="rounded p-1 text-dream-500 hover:bg-white">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={onReplace} title="替换文件" className="rounded p-1 text-dream-500 hover:bg-white">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button onClick={onDelete} title="删除" className="rounded p-1 text-red-500 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
