import { loadLibraryScenes } from '../../lib/libraryData'

export default function SceneOverview() {
  const scenes = loadLibraryScenes()
  return (
    <div className="mx-auto grid max-w-4xl gap-4 px-4 py-6 md:grid-cols-2">
      {scenes.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-xl border border-dream-100 bg-white shadow-sm">
          <img src={item.url} alt={item.name} className="h-36 w-full object-cover" />
          <div className="p-3"><p className="text-sm font-medium text-dream-800">{item.name}</p><p className="mt-1 text-xs text-dream-500">{item.usage}</p></div>
        </div>
      ))}
    </div>
  )
}

