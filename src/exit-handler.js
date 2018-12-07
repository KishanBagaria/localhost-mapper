import asyncOnExit from 'async-exit-hook'
import pacManager from './pac-manager'
import * as mappings from './mappings'
import { restoreBackup } from './network-config'
import * as console from './console'
import { certsFile } from './certs'

export async function exitHandler(callback) {
  try {
    await mappings.removeAll()
    if (await pacManager.isEmpty()) {
      await restoreBackup()
      if (await certsFile.exists()) await certsFile.delete()
    }
  } catch (err) {
    console.error(err)
  } finally {
    callback()
  }
}

let exitHandlerRegistered = false
export default function registerExitHandler() {
  if (exitHandlerRegistered) return
  asyncOnExit(exitHandler)
  exitHandlerRegistered = true
}
