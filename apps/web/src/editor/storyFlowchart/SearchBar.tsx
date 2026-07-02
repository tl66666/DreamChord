import { forwardRef, useState, useMemo } from 'react'
import { Search, Filter, X } from 'lucide-react'
import type { Scene } from '../sceneGraph'
import type { SceneFilter } from './types'

interface SearchBarProps {
  scenes: Scene[]
  chapters?: Array<{ id: string; title: string; order: number }>
  onSearch: (query: string) => void
  onFilter: (filter: SceneFilter) => void
  onJumpToScene: (sceneId: string) => void
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ scenes, chapters, onSearch, onFilter, onJumpToScene }, ref) => {
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<SceneFilter>({ chapter: 'all', sceneType: 'all', hasCharacters: false })
    const [showFilter, setShowFilter] = useState(false)
    const [showResults, setShowResults] = useState(false)

    // 搜索结果
    const results = useMemo(() => {
      if (!query.trim()) return []
      const q = query.trim().toLowerCase()
      return scenes.filter(s =>
        s.code.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        (s.preview || '').toLowerCase().includes(q)
      ).slice(0, 8)
    }, [scenes, query])

    const handleSearch = (val: string) => {
      setQuery(val)
      onSearch(val)
      setShowResults(val.trim().length > 0)
    }

    const handleFilterChange = (next: Partial<SceneFilter>) => {
      const merged = { ...filter, ...next }
      setFilter(merged)
      onFilter(merged)
    }

    return (
      <div className="absolute left-4 top-4 z-20 w-64">
        {/* 搜索框 */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dream-400" />
            <input
              ref={ref}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => query.trim() && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              placeholder="搜索场景代码或标题..."
              className="w-full rounded-lg border border-dream-200 bg-white py-1.5 pl-8 pr-7 text-xs text-dream-700 shadow-sm focus:border-dream-400 focus:outline-none focus:ring-1 focus:ring-dream-300"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); onSearch(''); setShowResults(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-dream-300 hover:text-dream-500"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`rounded-lg border p-1.5 shadow-sm transition ${showFilter ? 'border-dream-400 bg-dream-50 text-dream-600' : 'border-dream-200 bg-white text-dream-400 hover:text-dream-600'}`}
            title="过滤"
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 搜索结果下拉 */}
        {showResults && results.length > 0 && (
          <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-dream-200 bg-white py-1 shadow-lg">
            {results.map(scene => (
              <button
                key={scene.id}
                onMouseDown={() => { onJumpToScene(scene.id); setShowResults(false); setQuery('') }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-dream-50"
              >
                <span className="font-mono text-dream-400">{scene.code}</span>
                <span className="flex-1 truncate text-dream-700">{scene.title}</span>
              </button>
            ))}
          </div>
        )}
        {showResults && query.trim() && results.length === 0 && (
          <div className="mt-1 rounded-lg border border-dream-200 bg-white px-3 py-2 text-xs text-dream-400 shadow-lg">
            未找到匹配场景
          </div>
        )}

        {/* 过滤面板 */}
        {showFilter && (
          <div className="mt-1 space-y-2 rounded-lg border border-dream-200 bg-white p-2.5 shadow-lg">
            {/* 章节过滤 */}
            {chapters && chapters.length > 0 && (
              <div>
                <label className="mb-1 block text-[10px] font-medium text-dream-500">章节</label>
                <select
                  value={filter.chapter}
                  onChange={(e) => handleFilterChange({ chapter: e.target.value })}
                  className="w-full rounded border border-dream-200 bg-white px-2 py-1 text-xs"
                >
                  <option value="all">全部章节</option>
                  {chapters.map(ch => (
                    <option key={ch.id} value={String(ch.order + 1)}>{ch.title}</option>
                  ))}
                </select>
              </div>
            )}
            {/* 类型过滤 */}
            <div>
              <label className="mb-1 block text-[10px] font-medium text-dream-500">类型</label>
              <div className="flex flex-wrap gap-1">
                {[
                  { v: 'all', l: '全部' },
                  { v: 'choice', l: '选项' },
                  { v: 'normal', l: '普通' },
                  { v: 'branch', l: '分支' },
                  { v: 'ending', l: '结尾' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => handleFilterChange({ sceneType: opt.v as SceneFilter['sceneType'] })}
                    className={`rounded px-2 py-0.5 text-[11px] transition ${filter.sceneType === opt.v ? 'bg-dream-600 text-white' : 'bg-dream-50 text-dream-500 hover:bg-dream-100'}`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)

SearchBar.displayName = 'SearchBar'
export default SearchBar
