import { useState } from 'react'
import { BookOpen, Image as ImageIcon, Users } from 'lucide-react'
import StoryEditor from './workbench/StoryEditor'
import CharacterOverview from './workbench/CharacterOverview'
import SceneOverview from './workbench/SceneOverview'
import type { WorkbenchTab } from './workbench/workbenchTypes'

export default function WorkbenchPanel({ onSave }: { onSave: () => void }) {
  const [tab, setTab] = useState<WorkbenchTab>('story')
  return (
    <div className="flex h-full flex-col bg-dream-50/30">
      <div className="flex border-b border-dream-200 bg-white/90 px-4 pt-3 backdrop-blur-sm">
        <TabButton active={tab === 'story'} onClick={() => setTab('story')} icon={BookOpen} label="故事线" />
        <TabButton active={tab === 'characters'} onClick={() => setTab('characters')} icon={Users} label="角色" />
        <TabButton active={tab === 'scenes'} onClick={() => setTab('scenes')} icon={ImageIcon} label="场景" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'story' && <StoryEditor onSave={onSave} />}
        {tab === 'characters' && <CharacterOverview />}
        {tab === 'scenes' && <SceneOverview />}
      </div>
    </div>
  )
}
function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${active ? 'border-dream-600 text-dream-700' : 'border-transparent text-dream-400 hover:text-dream-600'}`}>
      <Icon className="h-4 w-4" />{label}
    </button>
  )
}
