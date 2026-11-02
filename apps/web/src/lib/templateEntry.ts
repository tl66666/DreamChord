export const CURTAIN_START_ROUTE = '/start/curtain-call'
export const CURTAIN_REQUEST_KEY = 'dreamchord_curtain_template_request'
export const PAINT_START_ROUTE = '/start/paint-prologue'
export const PAINT_REQUEST_KEY = 'dreamchord_paint_template_request'
export function safeAuthReturnTo(search: string) {
  const next = new URLSearchParams(search).get('next')
  return next === CURTAIN_START_ROUTE || next === PAINT_START_ROUTE ? next : '/'
}
export function beginPaintTemplate() {
  try { sessionStorage.removeItem(PAINT_REQUEST_KEY) } catch { /* Creation also works without a session store. */ }
  return PAINT_START_ROUTE
}
export function beginCurtainTemplate() {
  try { sessionStorage.removeItem(CURTAIN_REQUEST_KEY) } catch { /* A blocked session store still permits creation. */ }
  return CURTAIN_START_ROUTE
}
