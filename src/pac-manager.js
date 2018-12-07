import got from 'got'
import fse from 'fs-extra'
import rev from './util/rev'
import isProcessRunning from './util/is-process-running'
import { VERSION, PAC_STATE_FILE_PATH } from './constants'
import { startPACServer } from './server-manager'
import LocalhostMapperError from './errors'
import * as console from './console'

const getPACFile = ifs => (ifs.length ? `function FindProxyForURL(url, host) {
${ifs.join('\n')}
return 'DIRECT'
}
` : '')

const PACStateFile = {
  exists: () => fse.pathExists(PAC_STATE_FILE_PATH),
  read: () => fse.readJSON(PAC_STATE_FILE_PATH, { throws: false }),
  write: json => fse.writeJSON(PAC_STATE_FILE_PATH, json),
  delete: () => fse.unlink(PAC_STATE_FILE_PATH)
}

async function getPACState() {
  const defaultPacState = {
    version: VERSION,
    ifs: []
  }
  if (await PACStateFile.exists()) {
    const pacState = await PACStateFile.read()
    if (pacState && Array.isArray(pacState.ifs)) return pacState
  }
  return defaultPacState
}
const saveState = pacState => (
  pacState.ifs.length
    ? PACStateFile.write(pacState)
    : PACStateFile.exists().then(yes => yes && PACStateFile.delete())
)

const updateServer = (port, pac) =>
  got(`http://localhost:${port}/update`, { json: true, body: { pac }, retries: 1 })

async function onUpdate(pacState) {
  const serverState = await startPACServer()
  const pac = getPACFile(pacState.ifs.map(entry => entry.line))
  const url = `http://localhost:${serverState.port}/${rev(pac)}.pac`
  await saveState(pacState)
  if (serverState.port) {
    try {
      await updateServer(serverState.port, pac)
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        Object.assign(serverState, await startPACServer())
        await updateServer(serverState.port, pac)
      }
    }
  } else {
    console.error('Unable to update PAC server')
  }
  return { url }
}

const pruneDead = ifs => ifs.filter(entry => isProcessRunning(entry.pid))

const pacManager = {
  async isEmpty() {
    const pacState = await getPACState()
    pacState.ifs = pruneDead(pacState.ifs)
    return pacState.ifs.length === 0
  },
  async add({ pid, line, from, to }) {
    const pacState = await getPACState()
    const existingEntry = pacState.ifs.find(entry => entry.line.split('return')[0] === line.split('return')[0])
    if (existingEntry) {
      if (isProcessRunning(existingEntry.pid)) {
        throw new LocalhostMapperError(`${from} is already being mapped to ${existingEntry.to}`)
      }
      pacState.ifs = pruneDead(pacState.ifs)
    }
    pacState.ifs.push({ pid, line, to })
    return onUpdate(pacState)
  },
  async removeByLine(line) {
    const pacState = await getPACState()
    pacState.ifs = pacState.ifs.filter(entry => isProcessRunning(entry.pid) && entry.line !== line)
    return onUpdate(pacState)
  },
  async removeByPID(pid) {
    const pacState = await getPACState()
    const oldLength = pacState.ifs.length
    pacState.ifs = pacState.ifs.filter(entry => isProcessRunning(entry.pid) && entry.pid !== pid)
    const isStateChanged = oldLength !== pacState.ifs.length
    return isStateChanged ? onUpdate(pacState) : pacState
  }
}

export default pacManager
