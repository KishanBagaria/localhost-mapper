import childProcess from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import isProcessRunning from './util/is-process-running.js'
import pacServerStateFile from './pac-server-state.js'
import type { PACServerState } from './types.js'

const TRY_DELAY = 100 // ms
const MAX_TRIES = 20 // 2 seconds

const PAC_SERVER_ENTRY = fileURLToPath(new URL('./pac-server/index.js', import.meta.url))

function spawnPACServer(): void {
  // Detached and fully unref'd: the PAC server outlives whichever process
  // happened to start it, and doesn't keep that process alive either.
  const child = childProcess.spawn(process.execPath, [PAC_SERVER_ENTRY], {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
}

async function readPACServerState(): Promise<PACServerState | null> {
  const state = await pacServerStateFile.read()
  return state && isProcessRunning(state.pid) ? state : null
}

/** Returns the shared PAC server's state, starting it if it isn't running. */
export async function startPACServer(): Promise<PACServerState | null> {
  const running = await readPACServerState()
  if (running) return running

  spawnPACServer()
  for (let i = 0; i < MAX_TRIES; i += 1) {
    const state = await readPACServerState()
    if (state) return state
    await delay(TRY_DELAY)
  }
  return readPACServerState()
}
