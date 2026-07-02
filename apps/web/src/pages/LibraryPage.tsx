import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, BookOpen, Edit3, Image as ImageIcon, Loader2, Plus, RotateCcw, Save, Trash2, Upload, Users, X } from 'lucide-react'
import { deleteAsset, getMyProjects, getProjectAssets, renameAsset, uploadAsset, type Asset, type ProjectDetail } from '../api/client'
import {
  CHARACTER_KEY,
  SCENE_KEY,
  STORY_TEMPLATE_KEY,
  conflictTemplates,
  defaultCharacters,
  defaultScenes,
  defaultTemplates,
  loadLibraryCharacters,
  loadLibraryScenes,
  loadStoryTemplates,
  type LibraryCharacter,
  type LibraryScene,
  type StoryTemplate,
} from '../lib/libraryData'
import { useAuthStore } from '../stores/authStore'
import { useToast, useConfirm } from '../components/FeedbackProvider'

function getApiError(err: unknown, fallback = '操作失败'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    return response?.data?.error || fallback
  }
  return err instanceof Error ? err.message || fallback : fallback
}

type LibraryTab = 'characters' | 'scenes' | 'stories' | 'projectAssets'

const tabs: { id: LibraryTab; label: string; icon: ReactNode }[] = [
  { id: 'characters', label: '角色库', icon: <Users className="h-4 w-4" /> },
  { id: 'scenes', label: '场景库', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'stories', label: '剧情与模板', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'projectAssets', label: '项目上传', icon: <Archive className="h-4 w-4" /> },
]

export default function LibraryPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const toast = useToast()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = useState<LibraryTab>('characters')
  const [characters, setCharacters] = useStoredState(CHARACTER_KEY, defaultCharacters, loadLibraryCharacters)
  const [scenes, setScenes] = useStoredState(SCENE_KEY, defaultScenes, loadLibraryScenes)
  const [templates, setTemplates] = useStoredState(STORY_TEMPLATE_KEY, defaultTemplates, loadStoryTemplates)
  const [editingCharacter, setEditingCharacter] = useState<LibraryCharacter | null>(null)
  const [editingScene, setEditingScene] = useState<LibraryScene | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<StoryTemplate | null>(null)
  const [selectedExpression, setSelectedExpression] = useState<Record<string, string>>({})
  const [projects, setProjects] = useState<ProjectDetail[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetType, setAssetType] = useState('character')
  const [assetLoading, setAssetLoading] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId), [projects, selectedProjectId])

  useEffect(() => {
    if (!user) return
    getMyProjects()
      .then((items) => {
        setProjects(items)
        setSelectedProjectId((current) => current || items[0]?.id || '')
      })
      .catch(console.error)
  }, [user])

  useEffect(() => {
    if (!selectedProjectId) {
      setAssets([])
      return
    }
    setAssetLoading(true)
    getProjectAssets(selectedProjectId)
      .then(setAssets)
      .catch(console.error)
      .finally(() => setAssetLoading(false))
  }, [selectedProjectId])

  const saveCharacter = () => {
    if (!editingCharacter) return
    setCharacters((prev) => upsertById(prev, stamp({ ...editingCharacter, name: editingCharacter.name.trim() || '未命名角色' })))
    setEditingCharacter(null)
  }

  const saveScene = () => {
    if (!editingScene) return
    setScenes((prev) => upsertById(prev, stamp({ ...editingScene, name: editingScene.name.trim() || '未命名场景' })))
    setEditingScene(null)
  }

  const saveTemplate = () => {
    if (!editingTemplate) return
    setTemplates((prev) => upsertById(prev, stamp({ ...editingTemplate, title: editingTemplate.title.trim() || '未命名剧情素材' })))
    setEditingTemplate(null)
  }

  const useConflictTemplate = (title: string, content: string) => {
    setEditingTemplate({
      id: `template-${Date.now()}`,
      title,
      summary: '由戏剧冲突模板套入，可继续改写成项目剧情素材。',
      content,
      updatedAt: today(),
    })
  }

  const handleUpload = async (file: File | undefined) => {
    if (!file || !selectedProjectId) return
    setAssetLoading(true)
    try {
      const uploaded = await uploadAsset(selectedProjectId, file, assetType)
      setAssets((prev) => [uploaded, ...prev])
    } catch (err: unknown) {
      toast.error(getApiError(err, '上传失败，请确认已经登录并选择项目'))
    } finally {
      setAssetLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const confirmRename = async (asset: Asset) => {
    const name = renameValue.trim()
    if (!name) return
    const updated = await renameAsset(asset.id, name)
    setAssets((prev) => prev.map((item) => (item.id === asset.id ? updated : item)))
    setRenamingId(null)
  }

  const removeAsset = async (asset: Asset) => {
    if (!await confirm({ message: `确定删除素材"${asset.name}"吗？`, danger: true })) return
    await deleteAsset(asset.id)
    setAssets((prev) => prev.filter((item) => item.id !== asset.id))
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/assets/logo.png" alt="DreamChord" className="h-9 w-9 rounded-lg" />
            <div>
              <p className="text-sm font-semibold text-slate-500">DreamChord</p>
              <h1 className="text-xl font-bold text-slate-950">素材库</h1>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/ai-writer')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">AI 写作台</button>
            <button onClick={() => navigate(selectedProjectId ? `/editor/${selectedProjectId}` : '/')} className="rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700">去编辑器使用</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-2">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium ${activeTab === tab.id ? 'bg-dream-50 text-dream-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </aside>

        <section className="min-h-[680px] rounded-lg border border-slate-200 bg-white p-5">
          {activeTab === 'characters' && (
            <CharacterLibrary
              characters={characters}
              selectedExpression={selectedExpression}
              editingCharacter={editingCharacter}
              onSelectExpression={(characterId, expressionId) => setSelectedExpression((prev) => ({ ...prev, [characterId]: expressionId }))}
              onCreate={() => setEditingCharacter(newCharacter())}
              onEdit={(character) => setEditingCharacter(structuredClone(character))}
              onChange={setEditingCharacter}
              onSave={saveCharacter}
              onCancel={() => setEditingCharacter(null)}
              onDelete={(id) => setCharacters((prev) => prev.filter((item) => item.id !== id))}
              onReset={async () => { if (await confirm({ message: '确定恢复默认角色库吗？', danger: true })) setCharacters(defaultCharacters) }}
            />
          )}
          {activeTab === 'scenes' && (
            <SceneLibrary
              scenes={scenes}
              editingScene={editingScene}
              onCreate={() => setEditingScene(newScene())}
              onEdit={(scene) => setEditingScene({ ...scene })}
              onChange={setEditingScene}
              onSave={saveScene}
              onCancel={() => setEditingScene(null)}
              onDelete={(id) => setScenes((prev) => prev.filter((item) => item.id !== id))}
              onReset={async () => { if (await confirm({ message: '确定恢复默认场景库吗？', danger: true })) setScenes(defaultScenes) }}
            />
          )}
          {activeTab === 'stories' && (
            <StoryLibrary
              templates={templates}
              editingTemplate={editingTemplate}
              onCreate={() => setEditingTemplate(newTemplate())}
              onEdit={(template) => setEditingTemplate({ ...template })}
              onChange={setEditingTemplate}
              onSave={saveTemplate}
              onCancel={() => setEditingTemplate(null)}
              onDelete={(id) => setTemplates((prev) => prev.filter((item) => item.id !== id))}
              onUseConflict={useConflictTemplate}
            />
          )}
          {activeTab === 'projectAssets' && (
            <ProjectAssetLibrary
              user={user}
              projects={projects}
              selectedProjectId={selectedProjectId}
              selectedProjectTitle={selectedProject?.title}
              assets={assets}
              assetType={assetType}
              assetLoading={assetLoading}
              renamingId={renamingId}
              renameValue={renameValue}
              fileInputRef={fileInputRef}
              onSelectProject={setSelectedProjectId}
              onAssetTypeChange={setAssetType}
              onUpload={handleUpload}
              onStartRename={(asset) => { setRenamingId(asset.id); setRenameValue(asset.name) }}
              onRenameValueChange={setRenameValue}
              onConfirmRename={confirmRename}
              onCancelRename={() => setRenamingId(null)}
              onDelete={removeAsset}
              onRegisterScene={(asset) => {
                setScenes((prev) => upsertById(prev, stamp({
                  id: slugifyAssetName(asset.name, 'scene'),
                  name: stripAssetExtension(asset.name) || '新场景',
                  url: asset.url,
                  type: '用户上传',
                  description: '用户上传的背景场景，可在编辑器镜头卡里直接选择。',
                  usage: selectedProject?.title ? `用于《${selectedProject.title}》或其他故事项目。` : '用于故事场景背景。',
                  updatedAt: today(),
                })))
                setActiveTab('scenes')
              }}
              onRegisterCharacter={(asset) => {
                const characterId = slugifyAssetName(asset.name, 'character')
                setCharacters((prev) => upsertById(prev, stamp({
                  id: characterId,
                  name: stripAssetExtension(asset.name) || '新角色',
                  role: '用户角色',
                  description: '用户上传并登记的角色，可继续补充设定、小传和剧情冲突。',
                  biography: '',
                  outline: '',
                  usage: '对话节点、角色立绘、分支剧情',
                  conflicts: [],
                  color: '#8b5cf6',
                  defaultExpression: 'normal',
                  expressions: [{ id: 'normal', label: 'normal', url: asset.url }],
                  updatedAt: today(),
                })))
                setActiveTab('characters')
              }}
            />
          )}
        </section>
      </div>
    </main>
  )
}

function CharacterLibrary(props: {
  characters: LibraryCharacter[]
  selectedExpression: Record<string, string>
  editingCharacter: LibraryCharacter | null
  onSelectExpression: (characterId: string, expressionId: string) => void
  onCreate: () => void
  onEdit: (character: LibraryCharacter) => void
  onChange: (character: LibraryCharacter) => void
  onSave: () => void
  onCancel: () => void
  onDelete: (id: string) => void
  onReset: () => void
}) {
  const { characters, selectedExpression, editingCharacter, onSelectExpression, onCreate, onEdit, onChange, onSave, onCancel, onDelete, onReset } = props
  return (
    <div>
      <ToolbarTitle title="角色库" desc="管理人物设定、小传、故事大纲、戏剧冲突和立绘状态。编辑器会直接读取这里的角色。" createLabel="新增角色" onCreate={onCreate} onReset={onReset} />
      {editingCharacter && <CharacterEditor character={editingCharacter} onChange={onChange} onSave={onSave} onCancel={onCancel} />}
      <div className="grid gap-4 xl:grid-cols-2">
        {characters.map((character) => {
          const selected = character.expressions.find((item) => item.id === (selectedExpression[character.id] || character.defaultExpression)) || character.expressions[0]
          return (
            <article key={character.id} className="grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-[170px_1fr]">
              <button type="button" onClick={() => selected && window.open(selected.url, '_blank')} className="flex h-72 items-end justify-center overflow-hidden rounded-md border border-slate-100 bg-slate-50" title="点击查看原图">
                <img src={selected?.url || '/assets/characters/default-avatar.png'} alt={character.name} className="max-h-full max-w-full object-contain" />
              </button>
              <div className="min-w-0">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: character.color }} />
                      <h3 className="text-xl font-bold text-slate-950">{character.name}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{character.role}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">ID: {character.id} · 更新 {character.updatedAt}</p>
                  </div>
                  <RowActions onEdit={() => onEdit(character)} onDelete={() => onDelete(character.id)} />
                </div>
                <p className="mb-3 text-sm leading-6 text-slate-700">{character.description}</p>
                <InfoBlock title="人物小传" text={character.biography} />
                <InfoBlock title="故事大纲" text={character.outline} />
                <div className="mb-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">
                  <p className="mb-1 font-medium">戏剧冲突</p>
                  <ul className="list-inside list-disc space-y-1">{character.conflicts.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <p className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">项目用途：{character.usage}</p>
                <div className="flex flex-wrap gap-2">
                  {character.expressions.map((expression) => (
                    <button key={expression.id} type="button" onClick={() => onSelectExpression(character.id, expression.id)} className={`flex items-center gap-2 rounded-md border px-2 py-1 ${selected?.id === expression.id ? 'border-dream-400 bg-dream-50 text-dream-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                      <img src={expression.url} alt={expression.label} className="h-10 w-10 object-contain" />
                      <span className="text-xs">{expression.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function CharacterEditor({ character, onChange, onSave, onCancel }: { character: LibraryCharacter; onChange: (character: LibraryCharacter) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <EditorShell title="编辑角色" onSave={onSave} onCancel={onCancel}>
      <FormGrid>
        <TextField label="角色 ID" value={character.id} onChange={(value) => onChange({ ...character, id: value })} />
        <TextField label="名称" value={character.name} onChange={(value) => onChange({ ...character, name: value })} />
        <TextField label="定位" value={character.role} onChange={(value) => onChange({ ...character, role: value })} />
        <TextField label="颜色" value={character.color} onChange={(value) => onChange({ ...character, color: value })} />
      </FormGrid>
      <TextArea label="角色设定" value={character.description} onChange={(value) => onChange({ ...character, description: value })} />
      <TextArea label="人物小传" value={character.biography} onChange={(value) => onChange({ ...character, biography: value })} />
      <TextArea label="故事大纲" value={character.outline} onChange={(value) => onChange({ ...character, outline: value })} />
      <TextArea label="戏剧冲突（一行一个）" value={character.conflicts.join('\n')} onChange={(value) => onChange({ ...character, conflicts: value.split('\n').filter(Boolean) })} />
      <TextArea label="项目用途" value={character.usage} onChange={(value) => onChange({ ...character, usage: value })} />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">立绘状态</p>
          <button type="button" onClick={() => onChange({ ...character, expressions: [...character.expressions, { id: 'new', label: 'new', url: '/assets/characters/default-avatar.png' }] })} className="text-xs font-medium text-dream-700">添加立绘</button>
        </div>
        {character.expressions.map((expression, index) => (
          <div key={`${expression.id}-${index}`} className="grid gap-2 rounded-md border border-slate-200 p-2 md:grid-cols-[120px_140px_1fr_auto]">
            <input value={expression.id} onChange={(event) => updateExpression(character, onChange, index, { id: event.target.value })} className="rounded-md border border-slate-200 px-2 py-1 text-sm" />
            <input value={expression.label} onChange={(event) => updateExpression(character, onChange, index, { label: event.target.value })} className="rounded-md border border-slate-200 px-2 py-1 text-sm" />
            <input value={expression.url} onChange={(event) => updateExpression(character, onChange, index, { url: event.target.value })} className="rounded-md border border-slate-200 px-2 py-1 text-sm" />
            <button type="button" onClick={() => onChange({ ...character, expressions: character.expressions.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-md p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </EditorShell>
  )
}

function SceneLibrary(props: { scenes: LibraryScene[]; editingScene: LibraryScene | null; onCreate: () => void; onEdit: (scene: LibraryScene) => void; onChange: (scene: LibraryScene) => void; onSave: () => void; onCancel: () => void; onDelete: (id: string) => void; onReset: () => void }) {
  const { scenes, editingScene, onCreate, onEdit, onChange, onSave, onCancel, onDelete, onReset } = props
  return (
    <div>
      <ToolbarTitle title="场景库" desc="管理背景图、场景分类和剧情用途。编辑器背景节点会直接读取这里的场景。" createLabel="新增场景" onCreate={onCreate} onReset={onReset} />
      {editingScene && (
        <EditorShell title="编辑场景" onSave={onSave} onCancel={onCancel}>
          <FormGrid>
            <TextField label="场景 ID" value={editingScene.id} onChange={(value) => onChange({ ...editingScene, id: value })} />
            <TextField label="名称" value={editingScene.name} onChange={(value) => onChange({ ...editingScene, name: value })} />
            <TextField label="分类" value={editingScene.type} onChange={(value) => onChange({ ...editingScene, type: value })} />
            <TextField label="图片路径" value={editingScene.url} onChange={(value) => onChange({ ...editingScene, url: value })} />
          </FormGrid>
          <TextArea label="场景说明" value={editingScene.description} onChange={(value) => onChange({ ...editingScene, description: value })} />
          <TextArea label="项目用途" value={editingScene.usage} onChange={(value) => onChange({ ...editingScene, usage: value })} />
        </EditorShell>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {scenes.map((scene) => (
          <article key={scene.id} className="overflow-hidden rounded-lg border border-slate-200">
            <button type="button" onClick={() => window.open(scene.url, '_blank')} className="block w-full bg-slate-100">
              <img src={scene.url} alt={scene.name} className="h-56 w-full object-cover" />
            </button>
            <div className="p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{scene.name}</h3>
                  <p className="text-xs text-slate-500">ID: {scene.id} · {scene.type} · 更新 {scene.updatedAt}</p>
                </div>
                <RowActions onEdit={() => onEdit(scene)} onDelete={() => onDelete(scene.id)} />
              </div>
              <p className="text-sm leading-6 text-slate-700">{scene.description}</p>
              <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">项目用途：{scene.usage}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function StoryLibrary(props: { templates: StoryTemplate[]; editingTemplate: StoryTemplate | null; onCreate: () => void; onEdit: (template: StoryTemplate) => void; onChange: (template: StoryTemplate) => void; onSave: () => void; onCancel: () => void; onDelete: (id: string) => void; onUseConflict: (title: string, content: string) => void }) {
  const { templates, editingTemplate, onCreate, onEdit, onChange, onSave, onCancel, onDelete, onUseConflict } = props
  return (
    <div>
      <ToolbarTitle title="剧情素材与冲突模板" desc="管理可复用桥段，也可以把短剧式冲突模板直接套入，再改写成自己的剧情。" createLabel="新增剧情素材" onCreate={onCreate} />
      {editingTemplate && (
        <EditorShell title="编辑剧情素材" onSave={onSave} onCancel={onCancel}>
          <TextField label="标题" value={editingTemplate.title} onChange={(value) => onChange({ ...editingTemplate, title: value })} />
          <TextField label="摘要" value={editingTemplate.summary} onChange={(value) => onChange({ ...editingTemplate, summary: value })} />
          <TextArea label="正文" value={editingTemplate.content} onChange={(value) => onChange({ ...editingTemplate, content: value })} rows={7} />
        </EditorShell>
      )}
      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        {conflictTemplates.map((template) => (
          <article key={template.id} className="rounded-lg border border-rose-100 bg-rose-50/50 p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">{template.title}</h3>
                <p className="text-xs text-rose-600">{template.type} · {template.useFor}</p>
              </div>
              <button onClick={() => onUseConflict(template.title, `钩子：${template.hook}\n\n结构：${template.structure}\n\n适用：${template.useFor}`)} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white">套入</button>
            </div>
            <p className="text-sm leading-6 text-slate-700">{template.hook}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{template.structure}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-3">
        {templates.map((template) => (
          <article key={template.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">{template.title}</h3>
                <p className="text-xs text-slate-500">更新于 {template.updatedAt}</p>
              </div>
              <RowActions onEdit={() => onEdit(template)} onDelete={() => onDelete(template.id)} />
            </div>
            <p className="mb-3 text-sm text-slate-600">{template.summary}</p>
            <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{template.content}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function ProjectAssetLibrary(props: { user: unknown; projects: ProjectDetail[]; selectedProjectId: string; selectedProjectTitle?: string; assets: Asset[]; assetType: string; assetLoading: boolean; renamingId: string | null; renameValue: string; fileInputRef: React.RefObject<HTMLInputElement>; onSelectProject: (id: string) => void; onAssetTypeChange: (type: string) => void; onUpload: (file: File | undefined) => void; onStartRename: (asset: Asset) => void; onRenameValueChange: (value: string) => void; onConfirmRename: (asset: Asset) => void; onCancelRename: () => void; onDelete: (asset: Asset) => void; onRegisterScene: (asset: Asset) => void; onRegisterCharacter: (asset: Asset) => void }) {
  const { user, projects, selectedProjectId, selectedProjectTitle, assets, assetType, assetLoading, renamingId, renameValue, fileInputRef, onSelectProject, onAssetTypeChange, onUpload, onStartRename, onRenameValueChange, onConfirmRename, onCancelRename, onDelete, onRegisterScene, onRegisterCharacter } = props
  if (!user) {
    return (
      <div>
        <SectionTitle title="项目上传" desc="上传素材需要登录，因为文件要归属到具体故事项目。" />
        <Link to="/login" className="inline-flex rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700">登录后管理项目素材</Link>
      </div>
    )
  }
  return (
    <div>
      <SectionTitle title="项目上传" desc="管理当前项目的真实上传文件。角色库和场景库负责设定，这里负责文件。" />
      <div className="mb-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto_auto]">
        <select value={selectedProjectId} onChange={(event) => onSelectProject(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select>
        <select value={assetType} onChange={(event) => onAssetTypeChange(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="character">角色立绘</option>
          <option value="background">背景图</option>
          <option value="music">音乐</option>
          <option value="sound">音效</option>
          <option value="other">其他</option>
        </select>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700">
          {assetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          上传素材
          <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => onUpload(event.target.files?.[0])} />
        </label>
      </div>
      <p className="mb-3 text-sm text-slate-500">当前项目：{selectedProjectTitle || '未选择项目'}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => (
          <article key={asset.id} className="overflow-hidden rounded-lg border border-slate-200">
            {asset.type === 'music' || asset.type === 'sound' ? <div className="flex h-40 items-center justify-center bg-slate-100 text-sm text-slate-500">{asset.type.toUpperCase()}</div> : <img src={asset.url} alt={asset.name} className="h-40 w-full object-contain bg-slate-100" />}
            <div className="p-3">
              {renamingId === asset.id ? (
                <div className="flex gap-2">
                  <input value={renameValue} onChange={(event) => onRenameValueChange(event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" />
                  <button onClick={() => onConfirmRename(asset)} className="rounded-md bg-dream-600 px-2 text-xs text-white">保存</button>
                  <button onClick={onCancelRename} className="rounded-md border border-slate-200 px-2 text-xs">取消</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{asset.name}</h3>
                      <p className="text-xs text-slate-500">{asset.type} · {new Date(asset.createdAt).toLocaleDateString()}</p>
                    </div>
                    <RowActions onEdit={() => onStartRename(asset)} onDelete={() => onDelete(asset)} />
                  </div>
                  {!['music', 'sound'].includes(asset.type) && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => onRegisterCharacter(asset)} className="rounded-md border border-dream-200 bg-dream-50 px-2 py-1 text-xs font-medium text-dream-700 hover:bg-dream-100">
                        登记为角色
                      </button>
                      <button onClick={() => onRegisterScene(asset)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        登记为场景
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {!assetLoading && assets.length === 0 && <EmptyState text="这个项目还没有上传素材。" />}
    </div>
  )
}

function ToolbarTitle({ title, desc, createLabel, onCreate, onReset }: { title: string; desc: string; createLabel: string; onCreate: () => void; onReset?: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <SectionTitle title={title} desc={desc} />
      <div className="flex shrink-0 gap-2">
        {onReset && <button onClick={onReset} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RotateCcw className="h-4 w-4" />恢复默认</button>}
        <button onClick={onCreate} className="inline-flex items-center gap-2 rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700"><Plus className="h-4 w-4" />{createLabel}</button>
      </div>
    </div>
  )
}

function EditorShell({ title, children, onSave, onCancel }: { title: string; children: ReactNode; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="mb-5 rounded-lg border border-dream-200 bg-dream-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <div className="flex gap-2">
          <button onClick={onCancel} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><X className="h-4 w-4" />取消</button>
          <button onClick={onSave} className="inline-flex items-center gap-2 rounded-md bg-dream-600 px-3 py-2 text-sm font-medium text-white"><Save className="h-4 w-4" />保存</button>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex shrink-0 gap-1"><button onClick={onEdit} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="编辑"><Edit3 className="h-4 w-4" /></button><button onClick={onDelete} className="rounded-md p-2 text-red-500 hover:bg-red-50" title="删除"><Trash2 className="h-4 w-4" /></button></div>
}

function SectionTitle({ title, desc }: { title: string; desc: string }) {
  return <div><h2 className="text-2xl font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{desc}</p></div>
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" /></label>
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-6" /></label>
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return <div className="mb-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700"><p className="mb-1 font-medium text-slate-900">{title}</p><p className="leading-6">{text}</p></div>
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{text}</div>
}

function useStoredState<T>(key: string, fallback: T, loader?: () => T) {
  const [value, setValue] = useState<T>(() => {
    if (loader) return loader()
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}

function upsertById<T extends { id: string }>(items: T[], next: T) {
  return items.some((item) => item.id === next.id) ? items.map((item) => (item.id === next.id ? next : item)) : [next, ...items]
}

function stamp<T extends { updatedAt: string }>(item: T): T {
  return { ...item, updatedAt: today() }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function newCharacter(): LibraryCharacter {
  return { id: `character-${Date.now()}`, name: '', role: '', description: '', biography: '', outline: '', usage: '', conflicts: [], color: '#8b5cf6', defaultExpression: 'normal', expressions: [{ id: 'normal', label: 'normal', url: '/assets/characters/default-avatar.png' }], updatedAt: today() }
}

function newScene(): LibraryScene {
  return { id: `scene-${Date.now()}`, name: '', url: '/assets/backgrounds/bg-classroom.png', type: '', description: '', usage: '', updatedAt: today() }
}

function newTemplate(): StoryTemplate {
  return { id: `story-${Date.now()}`, title: '', summary: '', content: '', updatedAt: today() }
}

function stripAssetExtension(name: string) {
  return name.replace(/\.[^.]+$/, '').trim()
}

function slugifyAssetName(name: string, prefix: string) {
  const base = stripAssetExtension(name)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${prefix}-${base || Date.now()}`
}

function updateExpression(character: LibraryCharacter, onChange: (character: LibraryCharacter) => void, index: number, patch: Partial<LibraryCharacter['expressions'][number]>) {
  onChange({ ...character, expressions: character.expressions.map((expression, itemIndex) => (itemIndex === index ? { ...expression, ...patch } : expression)) })
}
