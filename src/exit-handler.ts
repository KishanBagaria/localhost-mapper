import { asyncExitHook } from 'exit-hook'
import pacManager from './pac-manager.js'
import * as mappings from './mappings.js'
import { restoreBackup } from './network-config.js'
import { certsFile } from './certs.js'
import * as console from './console.js'

const WAIT_MS = 5000

/**
 * Drops this process's mappings and, if nothing else on the machine is still
 * mapping anything, hands the OS proxy settings back to the user.
 */
export async function runExitCleanup(): Promise<void> {
  try {
    await mappings.removeAll()
    if (await pacManager.isEmpty()) {
      await restoreBackup()
      await certsFile.delete()
    }
  } catch (err) {
    console.error(err)
  }
}

let registered = false

export default function registerExitHandler(): void {
  if (registered) return
  // Handles beforeExit/SIGINT/SIGTERM. An explicit `process.exit()` can't be
  // awaited by anyone — callers who need that should use `gracefulExit()`.
  asyncExitHook(runExitCleanup, { wait: WAIT_MS })
  registered = true
}
