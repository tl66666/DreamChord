import { lookup as dnsLookup } from 'node:dns/promises'
import { request as httpRequest, type ClientRequest, type IncomingMessage, type RequestOptions } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'

export interface ResolvedAddress {
  address: string
  family: number
}

export type AddressResolver = (hostname: string, options: { all: true; verbatim: true }) => Promise<ResolvedAddress[]>
export type NodeRequest = (url: URL, options: RequestOptions, onResponse: (response: IncomingMessage) => void) => ClientRequest

interface TransportDependencies {
  resolve?: AddressResolver
  request?: NodeRequest
}

interface ProviderRequestOptions extends TransportDependencies {
  headers?: Record<string, string>
  signal?: AbortSignal
  maxRedirects?: number
  errorPrefix?: string
}

function isUnsafeIpv4(address: string): boolean {
  const [first, second, third] = address.split('.').map(Number)
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0 && third === 0)
    || (first === 192 && second === 0 && third === 2)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
    || first >= 224
}

function ipv6Value(address: string): bigint | null {
  let normalized = address.toLowerCase()
  const dotted = normalized.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const octets = dotted[2].split('.').map(Number)
    normalized = `${dotted[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`
  }
  const halves = normalized.split('::')
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const groups = [...left, ...(halves.length === 2 ? Array(8 - left.length - right.length).fill('0') : []), ...right]
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n)
}

export function isUnsafeProviderIp(address: string): boolean {
  if (isIP(address) === 4) return isUnsafeIpv4(address)
  if (isIP(address) !== 6) return true
  const value = ipv6Value(address)
  if (value === null || value === 0n || value === 1n) return true
  if ((value >> 121n) === 0x7en) return true // fc00::/7
  if ((value >> 118n) === 0x3fan) return true // fe80::/10
  if ((value >> 120n) === 0xffn) return true
  if ((value >> 96n) === 0x20010db8n) return true
  if ((value >> 32n) === 0xffffn) {
    const mapped = Number(value & 0xffff_ffffn)
    return isUnsafeIpv4(`${mapped >>> 24}.${(mapped >>> 16) & 255}.${(mapped >>> 8) & 255}.${mapped & 255}`)
  }
  return false
}

function parseProviderUrl(value: string): URL {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('Unsafe provider URL') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsafe provider URL')
  return url
}

export async function resolveSafeProviderUrl(value: string, resolve: AddressResolver = dnsLookup): Promise<{ url: URL; addresses: ResolvedAddress[] }> {
  const url = parseProviderUrl(value)
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (hostname === 'localhost') throw new Error('Unsafe provider URL')
  if (isIP(hostname)) {
    if (isUnsafeProviderIp(hostname)) throw new Error('Unsafe provider URL')
    return { url, addresses: [{ address: hostname, family: isIP(hostname) }] }
  }
  try {
    const addresses = await resolve(hostname, { all: true, verbatim: true })
    if (addresses.length === 0 || addresses.some(({ address }) => isUnsafeProviderIp(address))) throw new Error('Unsafe provider URL')
    return { url, addresses }
  } catch {
    throw new Error('Unsafe provider URL')
  }
}

export async function assertSafeProviderUrl(value: string | undefined, resolve: AddressResolver = dnsLookup): Promise<void> {
  if (value) await resolveSafeProviderUrl(value, resolve)
}

function pinnedLookup(addresses: ResolvedAddress[]): NonNullable<RequestOptions['lookup']> {
  return ((_hostname: string, options: { all?: boolean; family?: number }, callback: (...args: unknown[]) => void) => {
    const candidates = options.family ? addresses.filter(({ family }) => family === options.family) : addresses
    if (candidates.length === 0) {
      callback(Object.assign(new Error('No validated address for requested family'), { code: 'ENOTFOUND' }))
      return
    }
    if (options.all) callback(null, candidates)
    else callback(null, candidates[0].address, candidates[0].family)
  }) as NonNullable<RequestOptions['lookup']>
}

function readResponse(response: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    response.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    response.on('error', reject)
  })
}

function defaultRequest(url: URL, options: RequestOptions, onResponse: (response: IncomingMessage) => void): ClientRequest {
  return (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, options, onResponse)
}

async function send(
  url: URL,
  addresses: ResolvedAddress[],
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  signal: AbortSignal | undefined,
  request: NodeRequest,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, { method, headers, signal, lookup: pinnedLookup(addresses) }, resolve)
    outgoing.on('error', reject)
    if (body) outgoing.write(body)
    outgoing.end()
  })
}

export async function requestProviderJson<T = unknown>(urlValue: string, body: unknown, options: ProviderRequestOptions = {}): Promise<T> {
  const resolve = options.resolve ?? dnsLookup
  const request = options.request ?? defaultRequest
  const maxRedirects = options.maxRedirects ?? 5
  let current = urlValue
  let method = 'POST'
  let serializedBody: string | undefined = JSON.stringify(body)
  let headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers }

  for (let redirectCount = 0; ; redirectCount += 1) {
    const { url, addresses } = await resolveSafeProviderUrl(current, resolve)
    const response = await send(url, addresses, method, headers, serializedBody, options.signal, request)
    const location = response.headers.location
    if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode) && location) {
      response.resume()
      if (redirectCount >= maxRedirects) throw new Error('Provider redirect limit exceeded')
      const redirected = new URL(location, url)
      if (redirected.origin !== url.origin) {
        headers = Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'authorization'))
      }
      if (response.statusCode === 303 || ((response.statusCode === 301 || response.statusCode === 302) && method === 'POST')) {
        method = 'GET'
        serializedBody = undefined
        headers = Object.fromEntries(Object.entries(headers).filter(([name]) => !['content-type', 'content-length'].includes(name.toLowerCase())))
      }
      current = redirected.href
      continue
    }

    const responseBody = await readResponse(response)
    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`${options.errorPrefix ?? 'Provider'} API error: ${response.statusCode ?? 0} ${responseBody}`)
    }
    return JSON.parse(responseBody) as T
  }
}
