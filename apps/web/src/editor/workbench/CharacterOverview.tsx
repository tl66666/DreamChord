import { loadLibraryCharacters } from '../../lib/libraryData'

export default function CharacterOverview() {
  const characters = loadLibraryCharacters()
  return (
    <div className="mx-auto grid max-w-4xl gap-4 px-4 py-6 md:grid-cols-2">
      {characters.map((character) => (
        <div key={character.id} className="rounded-xl border border-dream-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><h3 className="font-semibold text-dream-900">{character.name}</h3><span className="text-xs text-dream-400">{character.id}</span></div>
          <p className="mt-2 text-xs text-dream-500">可用立绘：{character.expressions.map((item) => item.label).join(' / ')}</p>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-dream-600">{character.outline}</p>
        </div>
      ))}
    </div>
  )
}

