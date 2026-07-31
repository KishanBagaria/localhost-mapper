import http from 'node:http'
import getPort from 'get-port'
import exitHook from 'exit-hook'
import { VERSION, PREFERRED_HTTP_PORT, LOOPBACK_HOST } from '../constants.js'
import isProcessRunning from '../util/is-process-running.js'
import pacServerStateFile from '../pac-server-state.js'
import * as console from '../console.js'

const MAX_BODY_BYTES = 1024 * 1024

function isAlreadyRunning(): boolean {
  if (!pacServerStateFile.existsSync()) return false
  return isProcessRunning(pacServerStateFile.readSync()?.pid)
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > MAX_BODY_BYTES) throw new Error('Request body too large')
  }
  return body
}

async function startServer(): Promise<void> {
  const state = {
    version: VERSION,
    pid: process.pid,
    port: await getPort({ port: PREFERRED_HTTP_PORT })
  }
  let pac = ''

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/update') {
      readBody(req)
        .then(body => {
          pac = (JSON.parse(body) as { pac?: string }).pac || ''
          res.end('true')
          // No mappings left anywhere: nothing to serve, so shut down.
          if (!pac) server.close()
        })
        .catch((err: unknown) => {
          res.statusCode = 400
          res.end(String(err))
        })
      return
    }
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Content-Type', 'application/x-ns-proxy-autoconfig')
    res.end(pac)
  })

  exitHook(() => {
    pacServerStateFile.deleteSync()
    server.close()
  })

  server.listen(state.port, LOOPBACK_HOST, () => {
    pacServerStateFile.writeSync(state)
  })
}

// This module is spawned as a standalone, detached process — one PAC server is
// shared by every localhost-mapper process on the machine.
if (isAlreadyRunning()) process.exitCode = 1
else startServer().catch(console.error)
