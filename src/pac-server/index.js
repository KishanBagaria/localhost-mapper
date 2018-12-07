import express from 'express'
import bodyParser from 'body-parser'
import getPort from 'get-port'
import onExit from 'signal-exit'
import { VERSION, PREFERRED_HTTP_PORT } from '../constants'
import isProcessRunning from '../util/is-process-running'
import PACServerStateFile from '../PACServerStateFile'
import * as console from '../console'

function isAlreadyRunning() {
  if (PACServerStateFile.existsSync()) {
    const { pid } = PACServerStateFile.readSync() || {}
    return isProcessRunning(pid)
  }
  return false
}

function registerExitHandler(server) {
  onExit(() => {
    PACServerStateFile.deleteSync()
    server.close()
  })
}
async function startServer() {
  const savedState = {
    version: VERSION,
    pid: process.pid,
    port: await getPort({ port: PREFERRED_HTTP_PORT })
  }
  let pac = ''
  let server
  const app = express()
  app.disable('x-powered-by')
  app.post('/update', bodyParser.json(), (req, res) => {
    pac = req.body.pac || ''
    res.send(true)
    if (!pac) server.close()
  })
  app.use((req, res) => {
    res.header('Cache-Control', 'no-cache')
    res.send(pac)
  })
  server = app.listen(savedState.port, () => {
    PACServerStateFile.writeSync(savedState)
  })
  registerExitHandler(server)
}

if (isAlreadyRunning()) process.exitCode = 1
else startServer().catch(console.error)
