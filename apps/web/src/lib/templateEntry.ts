export const CURTAIN_START_ROUTE = '/start/curtain-call'
export const CURTAIN_REQUEST_KEY = 'dreamchord_curtain_template_request'
export function safeAuthReturnTo(search: string) {
  return new URLSearchParams(search).get('next') === CURTAIN_START_ROUTE ? CURTAIN_START_ROUTE : '/'
}
export function beginCurtainTemplate() {
  try { sessionStorage.removeItem(CURTAIN_REQUEST_KEY) } catch { /* A blocked session store still permits creation. */ }
  return CURTAIN_START_ROUTE
}
