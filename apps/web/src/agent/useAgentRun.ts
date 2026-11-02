import { useEffect, useState } from 'react'
import {
  applyAgentRun, cancelAgentRun, createAgentRun, getAgentRun, rejectAgentRun, retryAgentRun, undoAgentRun,
} from '../api/client'
import type { AgentProviderConfig, AgentRunDto, AppliedPatchDto, StartAgentRunInput } from './agentTypes'

const ACTIVE = new Set(['queued', 'planning', 'gathering_context', 'drafting', 'validating', 'applying'])
// Keep an accepted POST recoverable if its panel closes before the response arrives.
const pendingStarts = new Map<string, Promise<AgentRunDto>>()

function persistRun(key: string | undefined, id: string) {
  try { if (key) sessionStorage.setItem(`dreamchord_agent_run:${key}`, id) } catch { /* Optional browser storage. */ }
}

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  return error instanceof Error ? error.message : 'Agent 操作失败'
}

function readStoredRun(key?: string): string | null {
  try { return key ? sessionStorage.getItem(`dreamchord_agent_run:${key}`) : null } catch { return null }
}

export function useAgentRun(conversationKey?: string) {
  const [run, setRun] = useState<AgentRunDto | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [isRestoring, setRestoring] = useState(() => Boolean(readStoredRun(conversationKey) || (conversationKey && pendingStarts.has(conversationKey))))
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const id = readStoredRun(conversationKey)
    const pending = conversationKey ? pendingStarts.get(conversationKey) : undefined
    if (!id && !pending) { setRestoring(false); return }
    setRestoring(true)
    const request = pending ?? getAgentRun(id!)
    request.then((value) => { if (alive) setRun(value) }).catch(() => {
      if (!alive) return
      setError('上次任务暂时无法恢复，可重新打开对话重试。')
    }).finally(() => { if (alive) setRestoring(false) })
    return () => { alive = false }
  }, [conversationKey])

  useEffect(() => {
    if (!run || !conversationKey) return
    persistRun(conversationKey, run.id)
  }, [run, conversationKey])

  useEffect(() => {
    if (!run || !ACTIVE.has(run.status)) return
    let alive = true
    let polling = false
    const timer = window.setInterval(() => {
      if (polling) return
      polling = true
      getAgentRun(run.id).then((value) => { if (alive) { setRun(value); setError('') } }).catch((reason) => { if (alive) setError(errorMessage(reason)) }).finally(() => { polling = false })
    }, 1_500)
    return () => { alive = false; window.clearInterval(timer) }
  }, [run])

  const start = async (input: StartAgentRunInput) => {
    setSubmitting(true); setError('')
    let request = conversationKey ? pendingStarts.get(conversationKey) : undefined
    if (!request) {
      request = createAgentRun(input).then((value) => { persistRun(conversationKey, value.id); return value })
      if (conversationKey) pendingStarts.set(conversationKey, request)
    }
    try { setRun(await request) } catch (reason) { setError(errorMessage(reason)); throw reason } finally {
      if (conversationKey && pendingStarts.get(conversationKey) === request) pendingStarts.delete(conversationKey)
      setSubmitting(false)
    }
  }
  const requireRun = (): AgentRunDto => { if (!run) throw new Error('当前没有 Agent 任务'); return run }
  const cancel = async () => { const current = requireRun(); const next = await cancelAgentRun(current.id); setRun(next) }
  const reject = async () => { const current = requireRun(); const next = await rejectAgentRun(current.id); setRun(next) }
  const retry = async (providerConfig: AgentProviderConfig) => { const current = requireRun(); const next = await retryAgentRun(current.id, providerConfig); setRun(next) }
  const apply = async (): Promise<AppliedPatchDto> => { const current = requireRun(); const result = await applyAgentRun(current.id); setRun({ ...current, status: 'completed', completedAt: new Date().toISOString() }); return result }
  const undo = async (): Promise<AppliedPatchDto> => undoAgentRun(requireRun().id)
  const reset = () => {
    setRun(null); setError('')
    try { if (conversationKey) sessionStorage.removeItem(`dreamchord_agent_run:${conversationKey}`) } catch { /* Optional browser storage. */ }
  }

  return { run, isSubmitting: isSubmitting || isRestoring, error, start, cancel, reject, retry, apply, undo, reset }
}
