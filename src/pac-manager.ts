import jsonFile from './util/json-file.js'
import rev from './util/rev.js'
import isProcessRunning from './util/is-process-running.js'
import { VERSION, PAC_STATE_FILE_PATH, LOOPBACK_HOST } from './constants.js'
import { startPACServer } from './server-manager.js'
import { buildPACFile } from './pac-file.js'
import getUpstreamPAC from './upstream-pac.js'
import LocalhostMapperError from './errors.js'
import type { PACEntry, PACState } from './types.js'

const pacStateFile = jsonFile<PACState>(PAC_STATE_FILE_PATH)

async function getPACState(): Promise<PACState> {
  const pacState = await pacStateFile.read()
  if (pacState && Array.isArray(pacState.ifs)) return pacState
  return { version: VERSION, ifs: [] }
}

const saveState = async (pacState: PACState): Promise<void> => {
  if (pacState.ifs.length) await pacStateFile.write(pacState)
  else await pacStateFile.delete()
}

const isConnectionRefused = (err: unknown): boolean => {
  const codes = [err, err instanceof Error ? err.cause : undefined].map(
    value => (value as NodeJS.ErrnoException | undefined)?.code
  )
  return codes.includes('ECONNREFUSED')
}

async function pushToServer(port: number, pac: string): Promise<void> {
  const res = await fetch(`http://${LOOPBACK_HOST}:${port}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pac })
  })
  if (!res.ok) throw new LocalhostMapperError(`PAC server responded with ${res.status}`)
  await res.text()
}

/** Writes the new state to disk, pushes the PAC file to the server, and returns its URL. */
async function onUpdate(pacState: PACState): Promise<{ url: string }> {
  // Only worth reading the previous PAC if we're actually going to serve rules.
  const upstream = pacState.ifs.length ? await getUpstreamPAC() : null
  const pac = buildPACFile(
    pacState.ifs.map(entry => entry.line),
    upstream
  )
  await saveState(pacState)

  let serverState = await startPACServer()
  if (!serverState) throw new LocalhostMapperError('Unable to start the PAC server')

  try {
    await pushToServer(serverState.port, pac)
  } catch (err) {
    if (!isConnectionRefused(err)) throw err
    // The server shut down between us reading its state and talking to it.
    serverState = await startPACServer()
    if (!serverState) throw new LocalhostMapperError('Unable to start the PAC server')
    await pushToServer(serverState.port, pac)
  }

  // The content hash makes the URL change whenever the PAC file does, so the
  // OS and browsers can't serve a stale cached copy.
  return { url: `http://${LOOPBACK_HOST}:${serverState.port}/${rev(pac)}.pac` }
}

const pruneDead = (ifs: PACEntry[]): PACEntry[] => ifs.filter(entry => isProcessRunning(entry.pid))

/** The shared, on-disk set of mappings across every localhost-mapper process. */
const pacManager = {
  async isEmpty(): Promise<boolean> {
    const pacState = await getPACState()
    return pruneDead(pacState.ifs).length === 0
  },

  async add({ pid, line, from, to }: PACEntry & { from: string }): Promise<{ url: string }> {
    const pacState = await getPACState()
    const matches = (entry: PACEntry) => entry.line.split('return')[0] === line.split('return')[0]

    const existingEntry = pacState.ifs.find(matches)
    if (existingEntry) {
      if (isProcessRunning(existingEntry.pid)) {
        throw new LocalhostMapperError(`${from} is already being mapped to ${existingEntry.to}`)
      }
      pacState.ifs = pruneDead(pacState.ifs)
    }

    pacState.ifs.push({ pid, line, to })
    return onUpdate(pacState)
  },

  async removeByLine(line: string): Promise<{ url: string }> {
    const pacState = await getPACState()
    pacState.ifs = pruneDead(pacState.ifs).filter(entry => entry.line !== line)
    return onUpdate(pacState)
  },

  /** Returns `null` when this process owned no mappings, so nothing changed. */
  async removeByPID(pid: number): Promise<{ url: string } | null> {
    const pacState = await getPACState()
    const oldLength = pacState.ifs.length
    pacState.ifs = pruneDead(pacState.ifs).filter(entry => entry.pid !== pid)
    if (pacState.ifs.length === oldLength) return null
    return onUpdate(pacState)
  }
}

export default pacManager
