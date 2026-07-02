/**
 * MiniPreview.tsx — 右栏：实时预览
 *
 * 将当前选中的 ShotCard 即时渲染为 VN 风格画面，
 * 复用 resolveCharacterUrl 解析角色立绘。
 */

import { useMemo } from 'react'
import { Play, Eye, MessageSquare, GitBranch, Image as ImageIcon } from 'lucide-react'
import type { ShotCard } from './sceneGraph'
import { resolveCharacterUrl } from '../engine/characters'
import { resolveBgUrl } from './storyFlowchart/bgUrl'
import { loadLibraryCharacters, loadLibraryScenes } from '../lib/libraryData'

interface MiniPreviewProps {
  card: ShotCard | null
  onFullScreen: () => void
}

export default function MiniPreview({ card, onFullScreen }: MiniPreviewProps) {
  const characters = useMemo(() => loadLibraryCharacters(), [])
  const libraryScenes = useMemo(() => loadLibraryScenes(), [])


  const getCharName = (id: string): string => {
    return characters.find((c) => c.id === id)?.name || id
  }

  const getCharColor = (id: string): string => {
    return characters.find((c) => c.id === id)?.color || '#a78bfa'
  }

  const positionClass: Record<string, string> = {
    left: 'left-[8%]',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-[8%]',
  }

  const bgUrl = card ? resolveBgUrl(card.background, libraryScenes) : ''
  const visibleChars = (card?.characters || []).filter((c) => c.action !== 'hide')
  const speakerName = card && card.speaker !== '旁白' ? getCharName(card.speaker) : card?.lensType === 'system' ? '系统' : '旁白'
  const speakerColor = card && card.speaker !== '旁白' ? getCharColor(card.speaker) : '#94a3b8'

  return (
    <div className="flex h-full flex-col bg-gray-900">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white/80">
          <Eye className="h-4 w-4 text-dream-400" />
          实时预览
        </div>
        <button
          onClick={onFullScreen}
          className="inline-flex items-center gap-1.5 rounded-lg bg-dream-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-dream-700"
        >
          <Play className="h-3 w-3" />
          完整预览
        </button>
      </div>

      {/* 预览画面 */}
      <div className="relative flex-1 overflow-hidden">
        {card ? (
          <div className="relative h-full w-full">
            {/* 背景 */}
            <div className="absolute inset-0">
              {bgUrl ? (
                <img
                  src={bgUrl}
                  alt="背景"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                  <div className="text-center text-white/30">
                    <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    <p className="text-xs">请选择背景</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
            </div>

            {/* 角色立绘 */}
            {visibleChars.map((char, index) => {
              const url = char.characterId.startsWith('/uploads/') || char.characterId.startsWith('http')
                ? char.characterId
                : resolveCharacterUrl(char.characterId, char.expression)
              const pos = positionClass[char.position] || positionClass.center
              const isSpeaker = card.speaker === char.characterId && card.speaker !== '旁白'
              return (
                <div
                  key={`${char.characterId}-${index}`}
                  className={`absolute bottom-[28%] h-[60%] transition-all duration-300 ${pos} ${isSpeaker ? 'z-10' : 'z-0'}`}
                  style={{ filter: isSpeaker ? 'none' : 'brightness(0.6) saturate(0.7)' }}
                >
                  <img
                    src={url}
                    alt={getCharName(char.characterId)}
                    className="h-full object-contain drop-shadow-2xl"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.opacity = '0.2'
                    }}
                  />
                </div>
              )
            })}

            {/* 场景代码标签 */}
            <div className="absolute left-3 top-3 rounded-md bg-black/50 px-2 py-1 text-xs font-mono text-white/70 backdrop-blur-sm">
              {card.sceneCode}
            </div>

            {/* 镜头类型标签 */}
            <div className="absolute right-3 top-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white/70 backdrop-blur-sm">
              {card.lensType === 'dialogue' ? '对话' :
               card.lensType === 'narration' ? '旁白' :
               card.lensType === 'thought' ? '心理' :
               card.lensType === 'memory' ? '回忆' : '系统'}
            </div>

            {/* 底部对话框 */}
            <div className="absolute bottom-0 left-0 right-0">
              {card.type === 'choice' ? (
                /* 选项预览 */
                <div className="space-y-2 p-4">
                  {(card.choices || []).map((choice, index) => (
                    <div
                      key={`choice-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-white/20 bg-black/60 px-4 py-2.5 text-sm text-white/90 backdrop-blur-md"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-dream-500 text-xs font-bold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      {choice || `选项 ${index + 1}`}
                    </div>
                  ))}
                </div>
              ) : (
                /* 对话框 */
                <div className="bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pb-4 pt-8">
                  {/* 发言人名 */}
                  {card.text && (
                    <div
                      className="mb-1.5 inline-block rounded-t-lg px-3 py-1 text-sm font-bold"
                      style={{ backgroundColor: speakerColor, color: '#fff' }}
                    >
                      {speakerName}
                    </div>
                  )}
                  {/* 台词 */}
                  <div className="min-h-[3rem] rounded-lg rounded-tl-none bg-black/50 px-4 py-3 text-sm leading-relaxed text-white/95 backdrop-blur-sm">
                    {card.text || <span className="text-white/40">（空台词）</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-white/30">
            <div>
              <Eye className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">选中一个镜头卡</p>
              <p className="mt-1 text-xs">预览将在这里显示</p>
            </div>
          </div>
        )}
      </div>

      {/* 底部信息栏 */}
      {card && (
        <div className="border-t border-white/10 bg-black/40 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-white/50">
            <div className="flex items-center gap-3">
              {card.text && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {card.text.length} 字
                </span>
              )}
              {card.type === 'choice' && (
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {(card.choices || []).length} 选项
                </span>
              )}
              {visibleChars.length > 0 && (
                <span className="flex items-center gap-1">
                  {visibleChars.length} 角色
                </span>
              )}
            </div>
            <span className="font-mono">{card.sceneCode}</span>
          </div>
        </div>
      )}
    </div>
  )
}
