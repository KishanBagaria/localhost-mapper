import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { once } from 'node:events'
import { createProxyServer } from 'http-proxy-3'
import type { ServerOptions } from 'http-proxy-3'
import getPort from 'get-port'
import getSelfSignedCerts from './certs.js'
import { LOOPBACK_HOST } from './constants.js'
import * as console from './console.js'
import type { SSLCredentials } from './types.js'

export interface ProxyOptions extends ServerOptions {
  /** `true` generates self-signed certificates; pass credentials to use your own. */
  ssl?: SSLCredentials | boolean
  /** Preferred local port. Falls back to a random free port when taken. */
  port?: number
}

export interface ProxyHandle {
  /** The port the PAC file should point browsers at. */
  port: number
  close(): void
}

/**
 * Browsers reach HTTPS mappings by sending `CONNECT host:443` to the proxy.
 * We answer immediately and splice the socket onto our local TLS server, which
 * then terminates TLS with our self-signed certificate.
 */
const tunnelToTLSServer = (tlsPort: number) => (_req: http.IncomingMessage, socket: net.Socket) => {
  const upstream = net.connect(tlsPort, LOOPBACK_HOST)
  socket.pipe(upstream).pipe(socket)

  const onError = () => {
    socket.destroy()
    upstream.destroy()
  }
  upstream.on('error', onError)
  socket.on('error', onError)

  socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
}

async function listen(server: http.Server | https.Server, port: number): Promise<void> {
  server.listen(port, LOOPBACK_HOST)
  await once(server, 'listening')
}

export default async function createProxy(
  target: string,
  options: ProxyOptions = {}
): Promise<ProxyHandle> {
  const { ssl, port: preferredPort, ...proxyConfig } = options
  const credentials = ssl === true ? await getSelfSignedCerts() : ssl || undefined

  const proxy = createProxyServer({
    target,
    ws: true,
    changeOrigin: true,
    secure: false,
    ...proxyConfig
  })

  proxy.on('error', (err, _req, res) => {
    console.error(
      'An error occurred while proxying',
      target,
      err.message,
      (err as NodeJS.ErrnoException).code
    )
    // Without this the browser would hang until it times out.
    if (res instanceof net.Socket) res.destroy()
    else if (!res.headersSent) res.writeHead(502).end(`Cannot reach ${target}`)
    else res.end()
  })

  const onRequest: http.RequestListener = (req, res) => {
    proxy.web(req, res)
  }
  const onUpgrade = (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    proxy.ws(req, socket, head)
  }

  const port = await getPort(preferredPort ? { port: preferredPort } : {})
  const servers: (http.Server | https.Server)[] = []

  if (credentials) {
    const tlsPort = await getPort()
    const tlsServer = https.createServer(credentials, onRequest)
    tlsServer.on('upgrade', onUpgrade)
    await listen(tlsServer, tlsPort)

    const connectServer = http.createServer()
    connectServer.on('connect', tunnelToTLSServer(tlsPort))
    await listen(connectServer, port)
    // The TLS server already holds the event loop open for this mapping.
    connectServer.unref()

    servers.push(tlsServer, connectServer)
  } else {
    const server = http.createServer(onRequest)
    server.on('upgrade', onUpgrade)
    await listen(server, port)
    servers.push(server)
  }

  return {
    port,
    close() {
      for (const server of servers) server.close()
    }
  }
}
