import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { resolveCharacterName, resolveCharacterUrl } from '../engine/characters'
import { getStageSpritePresentation, type StagePreviewMode } from './stagePresentation'

export interface StageCharacter {
  id: string
  state: string
  position?: 'left' | 'center' | 'right'
  customUrl?: string
}

interface StageCharactersProps {
  characters: StageCharacter[]
  speakerId?: string
  mode?: StagePreviewMode
  className?: string
  resolveName?: (id: string) => string
  resolveUrl?: (id: string, expression: string) => string
}

function isSpecialStageCharacter(id: string) {
  const normalized = id.toLowerCase().trim()
  return normalized === 'ghost' || normalized === 'system-ghost'
}

export default function StageCharacters({
  characters,
  speakerId,
  mode = 'stage',
  className = '',
  resolveName = resolveCharacterName,
  resolveUrl = resolveCharacterUrl,
}: StageCharactersProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} data-stage-mode={mode}>
      <AnimatePresence mode="popLayout">
        {characters.map((character, index) => {
          const key = `${character.id}-${character.state}-${character.position || 'center'}`
          const isSpeaker = !speakerId || speakerId === character.id || resolveName(character.id) === speakerId
          const presentation = getStageSpritePresentation({
            mode,
            position: character.position || 'center',
            totalCharacters: characters.length,
            isSystem: isSpecialStageCharacter(character.id),
            isSpeaker,
          })
          const url = character.customUrl || resolveUrl(character.id, character.state)
          const failed = Boolean(failedImages[key])

          return (
            <div
              key={key}
              data-testid={`stage-character-${character.id}`}
              data-framing={presentation.framing}
              data-speaker={String(isSpeaker)}
              data-load-error={String(failed)}
              className="absolute"
              style={{
                left: `${presentation.anchorPercent}%`,
                width: `${presentation.widthPercent}%`,
                height: `${presentation.heightPercent}%`,
                bottom: `${presentation.bottomPercent}%`,
                zIndex: presentation.zIndex + index,
                transform: 'translateX(-50%)',
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 36, scale: presentation.scale * 0.98 }}
                animate={{
                  opacity: presentation.opacity,
                  y: 0,
                  scale: presentation.scale,
                  filter: `brightness(${presentation.brightness}) saturate(${presentation.saturation})`,
                }}
                exit={{ opacity: 0, y: 24, scale: presentation.scale * 0.99 }}
                transition={{ duration: 0.34, ease: 'easeOut' }}
                className="relative h-full w-full motion-reduce:transform-none motion-reduce:transition-none"
              >
                <div className="absolute bottom-[4%] left-1/2 h-6 w-[54%] -translate-x-1/2 rounded-[100%] bg-black/35 blur-lg" />
                {failed ? (
                  <div className="absolute inset-x-[16%] top-[22%] flex aspect-[3/4] items-center justify-center rounded-[45%_45%_18%_18%] border border-white/15 bg-slate-900/45 px-3 text-center text-xs text-white/55 backdrop-blur-sm">
                    立绘暂不可用
                  </div>
                ) : (
                  <motion.img
                    key={url}
                    src={url}
                    alt={resolveName(character.id)}
                    draggable={false}
                    className="h-full w-full select-none object-contain object-bottom drop-shadow-[0_18px_24px_rgba(0,0,0,0.48)]"
                    style={{
                      transform: `translateY(${presentation.imageTranslateYPercent}%) scale(${presentation.imageScale})`,
                      transformOrigin: 'center bottom',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    onError={() => setFailedImages((current) => ({ ...current, [key]: true }))}
                  />
                )}
              </motion.div>
            </div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

