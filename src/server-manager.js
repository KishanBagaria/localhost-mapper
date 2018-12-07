import path from 'path'
import childProcess from 'child_process'
import bluebird from 'bluebird'
import isProcessRunning from './util/is-process-running'
import PACServerStateFile from './PACServerStateFile'

const TRY_DELAY = 100 // ms
const MAX_TRIES = 20 // 2 seconds

function spawnScript(scriptPath) {
  const [nodeCommand] = process.argv
  childProcess.spawn(
    nodeCommand.includes('node') ? nodeCommand : 'node',
    [scriptPath],
    { detached: true, env: process.env }
  )
}

async function readPACServerState() {
  if (await PACServerStateFile.exists()) {
    const savedState = await PACServerStateFile.read()
    if (savedState && isProcessRunning(savedState.pid)) return savedState
  }
  return {}
}

// eslint-disable-next-line import/prefer-default-export
export async function startPACServer() {
  const serverState = await readPACServerState()
  if (!serverState.pid) {
    spawnScript(path.join(__dirname, 'pac-server'))
    for (const _ of Array(MAX_TRIES)) { // eslint-disable-line no-unused-vars
      if (await PACServerStateFile.exists()) break
      await bluebird.delay(TRY_DELAY)
    }
  }
  return readPACServerState()
}
