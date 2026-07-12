import { Readable, Writable } from 'node:stream'
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { requestProviderJson, type AddressResolver, type NodeRequest } from './providerTransport.js'

function response(statusCode: number, headers: Record<string, string> = {}, body = '{}'): IncomingMessage {
  const stream = Readable.from([body]) as IncomingMessage
  stream.statusCode = statusCode
  stream.headers = headers
  return stream
}

function requestSequence(items: IncomingMessage[], connectedAddresses: string[] = []): NodeRequest {
  return vi.fn((_url: URL, options: RequestOptions, onResponse: (response: IncomingMessage) => void) => {
    const request = new Writable({ write(_chunk, _encoding, callback) { callback() } }) as ClientRequest
    const lookup = options.lookup!
    lookup(_url.hostname, {}, (error, address) => {
      if (error) request.emit('error', error)
      else connectedAddresses.push(typeof address === 'string' ? address : address[0]!.address)
    })
    queueMicrotask(() => onResponse(items.shift()!))
    return request
  })
}

describe('provider transport', () => {
  it('rejects a redirect to a loopback IP before issuing the redirected request', async () => {
    const resolve = vi.fn<AddressResolver>().mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const request = requestSequence([response(307, { location: 'http://127.0.0.1/admin' })])

    await expect(requestProviderJson('https://models.example/v1/chat', {}, { resolve, request })).rejects.toThrow('Unsafe provider URL')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('rejects a redirect hostname when DNS returns a private address', async () => {
    const resolve = vi.fn<AddressResolver>()
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.20.30.40', family: 4 }])
    const request = requestSequence([response(302, { location: 'https://private.example/next' })])

    await expect(requestProviderJson('https://models.example/v1/chat', {}, { resolve, request })).rejects.toThrow('Unsafe provider URL')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('pins the validated address so DNS cannot rebind before connection', async () => {
    const connectedAddresses: string[] = []
    const resolve = vi.fn<AddressResolver>()
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }])
    const request = requestSequence([response(200, {}, '{"ok":true}')], connectedAddresses)

    await expect(requestProviderJson('https://models.example/v1/chat', {}, { resolve, request })).resolves.toMatchObject({ ok: true })
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(connectedAddresses).toEqual(['93.184.216.34'])
  })

  it('allows a public endpoint without a redirect', async () => {
    const connectedAddresses: string[] = []
    const resolve = vi.fn<AddressResolver>().mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ])
    const request = requestSequence([response(200, {}, '{"choices":[]}')], connectedAddresses)

    await expect(requestProviderJson('https://models.example/v1/chat', {}, { resolve, request })).resolves.toEqual({ choices: [] })
    expect(connectedAddresses).toEqual(['93.184.216.34'])
  })
})
