export const AUTOMATIC_VOICE_CHANGED = 'dreamchord:automatic-voice-changed'
const key = (projectId: string) => `dreamchord_automatic_voice_${projectId}`
export function automaticVoiceEnabled(projectId: string) {
  try { return localStorage.getItem(key(projectId)) === 'enabled' } catch { return false }
}
export function saveAutomaticVoice(projectId: string, enabled: boolean) {
  try { localStorage.setItem(key(projectId), enabled ? 'enabled' : 'paused') } catch { /* The editor remains usable without persistent preferences. */ }
  window.dispatchEvent(new Event(AUTOMATIC_VOICE_CHANGED))
}
export function enableAutomaticVoiceForBinding(projectId: string) {
  try { if (localStorage.getItem(key(projectId)) === 'paused') return } catch { return }
  saveAutomaticVoice(projectId, true)
}
