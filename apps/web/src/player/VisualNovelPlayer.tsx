import { useEffect, useMemo, useRef, useState, useCallback, forwardRef } from 'react'
import { useToast } from '../components/FeedbackProvider'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { History, SkipForward, Play, Pause, Settings, RotateCcw, Compass, PenLine, ChevronDown } from 'lucide-react'
import { getProject, type ProjectDetail } from '../api/client'
import { safeJsonParse } from '../lib/safeJsonParse'
import { createRuntimeEngine } from '../engine/runtime'
import { DEMO_RUNTIME_STORY } from '../engine/demo'
import { convertFlowToRuntime } from '../engine/converter'
import {
  CHARACTER_REGISTRY,
  resolveCharacterColor,
  resolveCharacterName,
  resolveCharacterUrl,
} from '../engine/characters'
import type { CharacterOnStage, RuntimeScene } from '../engine/types'

interface HistoryItem {
  sceneId: string
  role: string
  text: string
  speakerColor: string
}

interface PlayerSettings {
  textSpeed: number
  autoAdvance: boolean
  skipRead: boolean
  bgmVolume: number
  sfxVolume: number
}

const DEFAULT_SETTINGS: PlayerSettings = {
  textSpeed: 35,
  autoAdvance: false,
  skipRead: false,
  bgmVolume: 0.5,
  sfxVolume: 0.7,
}

const DEMO_ID = 'dreamchord-first-thread'

const POSITION_CLASS: Record<string, string> = {
  left: 'left-[5%] md:left-[12%]',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-[5%] md:right-[12%]',
}

type AudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext
}

export default function VisualNovelPlayer() {
  const toast = useToast()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [engine, setEngine] = useState<ReturnType<typeof createRuntimeEngine> | null>(null)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isAuto, setIsAuto] = useState(false)
  const [isSkip, setIsSkip] = useState(false)
  const [finished, setFinished] = useState(false)
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS)
  const [tick, setTick] = useState(0)

  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const playTone = useCallback(
    (type: 'tap' | 'choice' | 'scene') => {
      if (settings.sfxVolume <= 0) return
      try {
        const AudioContextCtor = window.AudioContext || (window as AudioWindow).webkitAudioContext
        if (!AudioContextCtor) return
        const ctx = audioContextRef.current || new AudioContextCtor()
        audioContextRef.current = ctx

        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        const now = ctx.currentTime
        const tone = {
          tap: { frequency: 520, duration: 0.035, volume: 0.035 },
          choice: { frequency: 740, duration: 0.11, volume: 0.06 },
          scene: { frequency: 330, duration: 0.075, volume: 0.03 },
        }[type]

        oscillator.type = type === 'choice' ? 'triangle' : 'sine'
        oscillator.frequency.setValueAtTime(tone.frequency, now)
        if (type === 'choice') {
          oscillator.frequency.exponentialRampToValueAtTime(tone.frequency * 1.35, now + tone.duration)
        }
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.linearRampToValueAtTime(tone.volume * settings.sfxVolume, now + 0.008)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration)
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start(now)
        oscillator.stop(now + tone.duration + 0.02)
      } catch {
        // Some browsers block audio until the first gesture. The UI should still work silently.
      }
    },
    [settings.sfxVolume],
  )

  useEffect(() => {
    const saved = localStorage.getItem('dreamchord_player_settings')
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
      } catch {
        // Ignore invalid local settings.
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('dreamchord_player_settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)

    if (projectId === DEMO_ID) {
      const runtime = createRuntimeEngine(DEMO_RUNTIME_STORY)
      setEngine(runtime)
      setProject({
        id: DEMO_ID,
        title: DEMO_RUNTIME_STORY.title,
        description: 'DreamChord Engine Demo',
        cover: '/assets/hero.png',
        isPublic: true,
        isPublished: true,
        author: { username: 'dreamchord', nickname: null },
        chapters: [],
        characters: [],
      })
      setLoading(false)
      return
    }

    getProject(projectId)
      .then((data) => {
        setProject(data)
        const { nodes, edges } = mergeChaptersForPreview(data)
        const runtimeStory = convertFlowToRuntime(data.id, data.title, nodes, edges)
        setEngine(createRuntimeEngine(runtimeStory))
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载项目失败')
      })
      .finally(() => setLoading(false))
  }, [location.search, projectId])

  const currentScene = useMemo(() => engine?.currentScene() || null, [engine, tick])

  const backgroundUrl = useMemo(() => {
    if (!currentScene) return '/assets/backgrounds/bg-starry.png'
    const bg = currentScene.background || 'bg-starry'
    if (bg.startsWith('/uploads/') || bg.startsWith('http')) return bg
    if (bg.startsWith('/assets/')) return bg
    if (bg.startsWith('illustrations/')) return `/assets/${bg}.png`
    if (bg.startsWith('covers/')) return `/assets/${bg}.png`
    return `/assets/backgrounds/${bg}.png`
  }, [currentScene])

  const characters = useMemo(() => currentScene?.characters || [], [currentScene])
  const speakerName = useMemo(() => resolveCharacterName(currentScene?.dialogue?.role || ''), [currentScene])
  const speakerColor = useMemo(() => resolveCharacterColor(currentScene?.dialogue?.role || ''), [currentScene])

  const stopTyping = useCallback(() => {
    if (typingRef.current) {
      clearInterval(typingRef.current)
      typingRef.current = null
    }
    setIsTyping(false)
  }, [])

  const pushHistory = useCallback((scene: RuntimeScene) => {
    const dialogue = scene.dialogue
    if (!dialogue?.text) return
    setHistory((prev) => [
      ...prev,
      {
        sceneId: scene.id,
        role: resolveCharacterName(dialogue.role),
        text: dialogue.text,
        speakerColor: resolveCharacterColor(dialogue.role),
      },
    ])
  }, [])

  const advance = useCallback(() => {
    if (!engine) return
    playTone('tap')
    if (isTyping) {
      stopTyping()
      setDisplayedText(currentScene?.dialogue?.text || '')
      return
    }
    if (currentScene?.choices) return

    const scene = engine.currentScene()
    if (scene) pushHistory(scene)

    const hasMore = engine.next()
    setTick((value) => value + 1)
    if (!hasMore) setFinished(true)
  }, [currentScene, engine, isTyping, playTone, pushHistory, stopTyping])

  const startTyping = useCallback(
    (text: string) => {
      stopTyping()
      if (isSkip) {
        setDisplayedText(text)
        setIsTyping(false)
        return
      }
      setDisplayedText('')
      setIsTyping(true)
      let index = 0
      const speed = Math.max(8, 80 - settings.textSpeed)
      typingRef.current = setInterval(() => {
        index += 1
        setDisplayedText(text.slice(0, index))
        if (index >= text.length) {
          stopTyping()
        }
      }, speed)
    },
    [isSkip, settings.textSpeed, stopTyping],
  )

  useEffect(() => {
    if (!isAuto || isTyping || currentScene?.choices || finished) return
    if (autoTimer.current) clearTimeout(autoTimer.current)
    autoTimer.current = setTimeout(() => advance(), 1200)
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current)
    }
  }, [advance, currentScene?.choices, finished, isAuto, isTyping])

  const selectChoice = useCallback(
    (index: number) => {
      if (!engine || !currentScene?.choices) return
      playTone('choice')
      pushHistory(currentScene)
      const hasMore = engine.choose(index)
      setTick((value) => value + 1)
      if (!hasMore) setFinished(true)
    },
    [currentScene, engine, playTone, pushHistory],
  )

  const restart = useCallback(() => {
    if (!engine) return
    setHistory([])
    setFinished(false)
    setIsAuto(false)
    setIsSkip(false)
    setEngine(createRuntimeEngine(engine.story))
    setTick(0)
  }, [engine])

  useEffect(() => {
    if (!currentScene) {
      setFinished(true)
      setDisplayedText('')
      return
    }
    playTone('scene')
    setFinished(false)
    const text = currentScene.dialogue?.text || ''
    if (text) startTyping(text)
    else {
      setDisplayedText('')
      setIsTyping(false)
    }
  }, [currentScene, playTone, startTyping])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showHistory || showSettings) {
        if (event.key === 'Escape') {
          setShowHistory(false)
          setShowSettings(false)
        }
        return
      }
      if (finished) return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        advance()
      } else if (event.key === 'h' || event.key === 'H') {
        setShowHistory((value) => !value)
      } else if (event.key === 's' || event.key === 'S') {
        setIsSkip((value) => !value)
      } else if (event.key === 'a' || event.key === 'A') {
        setIsAuto((value) => !value)
      } else if (event.key >= '1' && event.key <= '9') {
        selectChoice(parseInt(event.key, 10) - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [advance, finished, selectChoice, showHistory, showSettings])

  useEffect(() => {
    return () => {
      stopTyping()
      if (autoTimer.current) clearTimeout(autoTimer.current)
    }
  }, [stopTyping])

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        <p className="text-sm opacity-70">加载故事中...</p>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white" onClick={() => advance()}>
      <AnimatePresence mode="wait">
        <motion.div
          key={backgroundUrl}
          initial={{ opacity: 0, scale: 1.025 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <img src={backgroundUrl} alt="背景" className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/62" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_42%,transparent_0%,rgba(0,0,0,0.18)_55%,rgba(0,0,0,0.5)_100%)]" />
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 z-[5] opacity-70 mix-blend-screen">
        <motion.div
          key={currentScene?.id}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute left-[-8%] top-[21%] h-px w-[116%] bg-gradient-to-r from-transparent via-dream-300/35 to-transparent"
        />
        <div className="absolute bottom-[28%] right-[8%] h-32 w-32 rounded-full border border-dream-200/10 shadow-[0_0_45px_rgba(167,139,250,0.16)]" />
      </div>

      <AnimatePresence>
        {engine?.state.activeUIEvents.map((event, index) => (
          <motion.div
            key={`${currentScene?.id}-${event}-${index}`}
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.36, delay: index * 0.06 }}
            className="absolute right-4 top-20 z-30"
          >
            <div className="rounded-lg border border-dream-300/35 bg-black/50 px-3 py-1.5 font-mono text-xs text-dream-100 backdrop-blur-md shadow-[0_0_20px_rgba(167,139,250,0.25)]">
              {event}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="absolute inset-0 z-10">
        <AnimatePresence mode="popLayout">
          {characters.map((character, index) => (
            <CharacterSprite
              key={`${character.id}-${character.state}-${character.position}`}
              character={character}
              isSystem={CHARACTER_REGISTRY[character.id]?.layer === 'system'}
              zIndex={10 + index}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-5 z-40 hidden -translate-x-1/2 rounded-full border border-white/12 bg-black/32 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md md:block">
        {project?.title || 'DreamChord'}
      </div>

      <div className="absolute right-4 top-4 z-40 flex items-center gap-2">
        <IconButton title="历史 (H)" onClick={() => setShowHistory(true)} icon={<History className="h-4 w-4" />} />
        <IconButton
          title="跳过 (S)"
          active={isSkip}
          onClick={() => setIsSkip((value) => !value)}
          icon={<SkipForward className="h-4 w-4" />}
        />
        <IconButton
          title="自动 (A)"
          active={isAuto}
          onClick={() => setIsAuto((value) => !value)}
          icon={isAuto ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        />
        <IconButton title="设置" onClick={() => setShowSettings(true)} icon={<Settings className="h-4 w-4" />} />
      </div>

      <AnimatePresence mode="wait">
        {currentScene?.dialogue && (
          <motion.div
            key={currentScene.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.24 }}
            className="absolute bottom-0 left-0 right-0 z-40"
            onClick={(event) => {
              event.stopPropagation()
              advance()
            }}
          >
            <div className="relative w-full border-t border-white/10 bg-gradient-to-t from-black via-black/95 to-black/82 px-5 pb-8 pt-5 shadow-[0_-8px_40px_rgba(0,0,0,0.62)] backdrop-blur-xl md:px-8 md:pb-10 md:pt-6">
              <div
                className="absolute left-0 top-0 h-[2px] w-full"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${speakerColor} 20%, ${speakerColor} 80%, transparent 100%)`,
                  opacity: 0.75,
                }}
              />
              <div className="mx-auto w-full max-w-6xl">
                {speakerName && (
                  <div className="mb-3 inline-flex items-center gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-sm font-semibold md:text-base"
                      style={{
                        background: `${speakerColor}22`,
                        color: speakerColor,
                        boxShadow: `0 0 12px ${speakerColor}30`,
                      }}
                    >
                      {speakerName}
                    </span>
                  </div>
                )}
                <p className="min-h-[3.7rem] max-w-5xl text-lg leading-relaxed text-white/95 md:text-xl md:leading-relaxed">
                  {displayedText}
                  {isTyping && <span className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-white/70" />}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-white/42">
                    {isAuto ? '自动播放中' : isSkip ? '跳过中' : '点击继续'}
                  </span>
                  <ChevronDown className="h-5 w-5 animate-bounce text-white/42" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {currentScene?.choices && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28 }}
            className="absolute bottom-[31vh] left-0 right-0 z-50 flex flex-col items-center gap-3 px-5 md:bottom-[34vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-1 rounded-full border border-dream-200/25 bg-black/45 px-3 py-1 text-xs tracking-[0.18em] text-dream-100/80 backdrop-blur-md">
              BRANCH SELECT
            </div>
            {currentScene.choices.map((choice, index) => (
              <button
                key={choice}
                onClick={(event) => {
                  event.stopPropagation()
                  selectChoice(index)
                }}
                className="group relative w-full max-w-2xl overflow-hidden rounded-xl border border-white/20 bg-black/48 px-5 py-4 text-left text-white shadow-[0_16px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-dream-200 hover:bg-white/15 hover:shadow-[0_18px_45px_rgba(167,139,250,0.18)]"
              >
                <span className="absolute inset-y-0 left-0 w-1 bg-dream-300/70 opacity-60 transition group-hover:opacity-100" />
                <span className="absolute inset-0 bg-gradient-to-r from-dream-400/0 to-cyan-300/0 transition group-hover:from-dream-400/10 group-hover:to-cyan-300/10" />
                <span className="relative mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-dream-200/30 bg-dream-500/20 font-mono text-sm text-dream-100">
                  {index + 1}
                </span>
                <span className="relative text-base font-medium leading-relaxed">{choice}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-w-md rounded-2xl border border-white/10 bg-black/64 p-8 text-center shadow-2xl">
              <h2 className="mb-2 text-2xl font-bold text-white">第一章 · 节点觉醒</h2>
              <p className="mb-6 text-sm text-white/60">现实已保存，故事才刚刚开始。</p>
              <div className="flex flex-col gap-3">
                <button onClick={restart} className="inline-flex items-center justify-center gap-2 rounded-xl bg-dream-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-dream-700">
                  <RotateCcw className="h-4 w-4" />
                  重新阅读
                </button>
                <button onClick={() => (window.location.href = '/explore')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white transition hover:bg-white/10">
                  <Compass className="h-4 w-4" />
                  发现更多
                </button>
                <button onClick={() => (window.location.href = '/')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white transition hover:bg-white/10">
                  <PenLine className="h-4 w-4" />
                  创作故事
                </button>
                {projectId && projectId !== DEMO_ID && (
                  <button onClick={() => navigate(`/editor/${projectId}`)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-dream-300/30 bg-dream-500/20 px-5 py-2.5 text-sm text-white transition hover:bg-dream-500/30">
                    <PenLine className="h-4 w-4" />
                    回到工作台
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <SidePanel title="历史记录" onClose={() => setShowHistory(false)}>
            <div className="space-y-4">
              {history.length === 0 ? (
                <p className="text-sm text-white/40">还没有历史记录</p>
              ) : (
                history.map((item, index) => (
                  <div key={`${item.sceneId}-${index}`} className="border-l-2 border-white/10 pl-3">
                    <span className="text-xs font-semibold" style={{ color: item.speakerColor }}>
                      {item.role}
                    </span>
                    <p className="mt-1 text-sm text-white/80">{item.text}</p>
                  </div>
                ))
              )}
            </div>
          </SidePanel>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/82 p-6 shadow-2xl">
              <h3 className="mb-4 text-lg font-semibold text-white">播放设置</h3>
              <div className="space-y-5">
                <RangeControl
                  label="文字速度"
                  value={settings.textSpeed}
                  min={10}
                  max={80}
                  onChange={(value) => setSettings((old) => ({ ...old, textSpeed: value }))}
                />
                <RangeControl
                  label="音效音量"
                  value={Math.round(settings.sfxVolume * 100)}
                  min={0}
                  max={100}
                  onChange={(value) => setSettings((old) => ({ ...old, sfxVolume: value / 100 }))}
                />
              </div>
              <button onClick={() => setShowSettings(false)} className="mt-6 w-full rounded-xl bg-white/10 py-2 text-sm text-white transition hover:bg-white/20">
                完成
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function IconButton({
  title,
  icon,
  active = false,
  onClick,
}: {
  title: string
  icon: React.ReactNode
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={`rounded-lg p-2 backdrop-blur-md transition ${
        active ? 'bg-dream-500/80 text-white' : 'bg-black/42 text-white/90 hover:bg-white/12'
      }`}
      title={title}
    >
      {icon}
    </button>
  )
}

function RangeControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm text-white/70">
        {label}
        <span className="font-mono text-xs text-white/45">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(parseInt(event.target.value, 10))}
        className="w-full accent-dream-400"
      />
    </label>
  )
}

function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="absolute inset-y-0 left-0 z-50 w-full max-w-md border-r border-white/10 bg-black/82 p-6 backdrop-blur-xl md:w-96"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:bg-white/10">
          关闭
        </button>
      </div>
      <div className="overflow-y-auto pb-4" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        {children}
      </div>
    </motion.div>
  )
}

const CharacterSprite = forwardRef<
  HTMLDivElement,
  {
    character: CharacterOnStage
    zIndex: number
    isSystem: boolean
  }
>(function CharacterSprite({ character, zIndex, isSystem }, ref) {
  const url = character.customUrl || resolveCharacterUrl(character.id, character.state)
  const positionClass = POSITION_CLASS[character.position || 'center']

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 70, scale: 0.965, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 46, scale: 0.985, filter: 'blur(3px)' }}
      transition={{ duration: 0.52, ease: 'easeOut' }}
      className={`absolute bottom-0 h-[76vh] w-[45vw] md:w-[31vw] ${positionClass}`}
      style={{ zIndex }}
    >
      <div
        className="pointer-events-none absolute bottom-[2%] left-1/2 h-6 w-[50%] -translate-x-1/2 rounded-[100%] opacity-40 blur-md"
        style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, transparent 75%)' }}
      />
      <div
        className="relative h-full w-full"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)',
        }}
      >
        <motion.img
          key={url}
          src={url}
          alt={character.id}
          className="h-full w-full object-contain object-bottom"
          initial={{ opacity: 0, scale: 1.012 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          style={{
            filter: isSystem
              ? 'drop-shadow(0 10px 18px rgba(0,0,0,0.35)) drop-shadow(0 0 20px rgba(167,139,250,0.3))'
              : 'drop-shadow(0 10px 18px rgba(0,0,0,0.35))',
          }}
        />
      </div>
    </motion.div>
  )
})

function mergeChaptersForPreview(project: ProjectDetail) {
  const nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }> = []
  const edges: Array<{
    id: string
    source: string
    target: string
    label?: string
    sourceHandle?: string
    animated?: boolean
  }> = []

  const sortedChapters = [...project.chapters].sort((a, b) => a.order - b.order)
  let previousTerminalIds: string[] = []

  sortedChapters.forEach((chapter) => {
    const prefix = `${chapter.id}:`
    const chapterNodes = chapter.nodes.map((node) => ({
      id: `${prefix}${node.nodeId}`,
      type: node.type,
      position: { x: node.positionX, y: node.positionY },
      data: safeJsonParse<Record<string, unknown>>(node.data, {}),
    }))
    const chapterEdges = chapter.edges.map((edge) => ({
      id: `${prefix}${edge.edgeId}`,
      source: `${prefix}${edge.source}`,
      target: `${prefix}${edge.target}`,
      label: edge.label || undefined,
      sourceHandle: edge.sourceHandle || undefined,
      animated: edge.animated,
    }))
    const chapterStart = findPreviewStart(chapterNodes, chapterEdges)
    if (chapterStart) {
      previousTerminalIds.forEach((terminalId) => {
        edges.push({
          id: `chapter-link-${terminalId}-${chapterStart.id}`,
          source: terminalId,
          target: chapterStart.id,
          animated: true,
        })
      })
    }

    nodes.push(...chapterNodes)
    edges.push(...chapterEdges)
    previousTerminalIds = findPreviewTerminals(chapterNodes, chapterEdges)
  })

  return { nodes, edges }
}

function findPreviewStart(nodes: Array<{ id: string }>, edges: Array<{ target: string }>) {
  const targets = new Set(edges.map((edge) => edge.target))
  return nodes.find((node) => !targets.has(node.id)) || nodes[0]
}

function findPreviewTerminals(nodes: Array<{ id: string }>, edges: Array<{ source: string }>) {
  const sources = new Set(edges.map((edge) => edge.source))
  const terminals = nodes.filter((node) => !sources.has(node.id)).map((node) => node.id)
  return terminals.length > 0 ? terminals : nodes.slice(-1).map((node) => node.id)
}
