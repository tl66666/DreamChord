import { useEffect, useState } from 'react'
import {
  applyAgentRun, cancelAgentRun, createAgentRun, getAgentRun, rejectAgentRun, retryAgentRun, undoAgentRun,
} from '../api/client'
import type { AgentProviderConfig, AgentRunDto, AppliedPatchDto, StartAgentRunInput } from './agentTypes'

const ACTIVE = new Set(['queued', 'planning', 'gathering_context', 'drafting', 'validating', 'applying'])

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  return error instanceof Error ? error.message : 'Agent 操作失败'
}

export function useAgentRun() {
  const [run, setRun] = useState<AgentRunDto | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!run || !ACTIVE.has(run.status)) return
    const timer = window.setTimeout(() => {
      getAgentRun(run.id).then(setRun).catch((reason) => setError(errorMessage(reason)))
    }, 1_500)
    return () => window.clearTimeout(timer)
  }, [run])

  const start = async (input: StartAgentRunInput) => {
    setSubmitting(true); setError('')
    try { setRun(await createAgentRun(input)) } catch (reason) { setError(errorMessage(reason)); throw reason } finally { setSubmitting(false) }
  }
  const requireRun = (): AgentRunDto => { if (!run) throw new Error('当前没有 Agent 任务'); return run }
  const cancel = async () => { const current = requireRun(); const next = await cancelAgentRun(current.id); setRun(next) }
  const reject = async () => { const current = requireRun(); const next = await rejectAgentRun(current.id); setRun(next) }
  const retry = async (providerConfig: AgentProviderConfig) => { const current = requireRun(); const next = await retryAgentRun(current.id, providerConfig); setRun(next) }
  const apply = async (): Promise<AppliedPatchDto> => { const current = requireRun(); const result = await applyAgentRun(current.id); setRun({ ...current, status: 'completed', completedAt: new Date().toISOString() }); return result }
  const undo = async (): Promise<AppliedPatchDto> => undoAgentRun(requireRun().id)
  const reset = () => { setRun(null); setError('') }

  return { run, isSubmitting, error, start, cancel, reject, retry, apply, undo, reset }
}
