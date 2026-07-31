import http from 'node:http'
import https from 'node:https'
import { once } from 'node:events'
import getPort from 'get-port'
import { generate } from 'selfsigned'

export interface TestServer {
  port: number
  server: http.Server | https.Server
}

const respondWith =
  (body: string): http.RequestListener =>
  (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(body)
  }

async function start(server: http.Server | https.Server): Promise<TestServer> {
  const port = await getPort()
  server.listen(port)
  await once(server, 'listening')
  return { port, server }
}

export const createTestServer = (body: string): Promise<TestServer> =>
  start(http.createServer(respondWith(body)))

export async function createTestSecureServer(body: string): Promise<TestServer> {
  const { cert, private: key } = await generate(
    [{ name: 'commonName', value: 'localhost-mapper-test' }],
    { algorithm: 'sha256' }
  )
  return start(https.createServer({ key, cert }, respondWith(body)))
}
