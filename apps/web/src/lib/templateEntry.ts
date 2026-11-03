export const CURTAIN_START_ROUTE = '/start/curtain-call'
export const CURTAIN_REQUEST_KEY = 'dreamchord_curtain_template_request'
export const PAINT_START_ROUTE = '/start/paint-prologue'
export const PAINT_REQUEST_KEY = 'dreamchord_paint_template_request'
export function safeAuthReturnTo(search: string) {
  const next = new URLSearchParams(search).get('next')
  return next === CURTAIN_START_ROUTE || next === PAINT_START_ROUTE ? next : '/'
}
export function beginPaintTemplate() {
  return PAINT_START_ROUTE
}
export function beginCurtainTemplate() {
  return CURTAIN_START_ROUTE
}

/** A durable owner-scoped request makes repeated “continue writing” visits idempotent. */
export function templateRequestId(storage: Pick<Storage, 'getItem' | 'setItem'>, kind: 'paint' | 'curtain', ownerId: string, uuid: () => string = () => crypto.randomUUID(), fresh = false) {
  const key = `dreamchord_template_v2:${encodeURIComponent(ownerId)}:${kind}`
  const prior = fresh ? null : storage.getItem(key)
  if (prior && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(prior)) return prior
  const id = uuid()
  storage.setItem(key, id)
  return id
}

export async function resumeTemplateRequest<T>(requestId: string, create: (id: string) => Promise<T>, replaceDeletedRequest: () => string): Promise<T> {
  try { return await create(requestId) }
  catch (error) {
    const response = (error as { response?: { status?: number; data?: { code?: string } } } | null)?.response
    if (response?.status !== 409 || response.data?.code !== 'TEMPLATE_COPY_DELETED') throw error
    return create(replaceDeletedRequest())
  }
}
