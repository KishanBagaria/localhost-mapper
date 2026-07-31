import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

// Read rather than `import ... with { type: 'json' }` so package.json stays
// outside `rootDir` and the compiled layout matches the source layout.
const pkg = createRequire(import.meta.url)('../package.json') as {
  name: string
  version: string
}

export const PKG = pkg
export const VERSION = pkg.version

export const PREFERRED_HTTP_PORT = 1122

/**
 * Every server we start binds here, and every URL we generate points here.
 *
 * Binding matters: the default binds to all interfaces, which would put the PAC
 * server's `/update` endpoint — and every mapping's proxy — on the local
 * network. Using the literal address rather than `localhost` also sidesteps it
 * resolving to `::1` on some systems while we listen only on IPv4.
 */
export const LOOPBACK_HOST = '127.0.0.1'

const inHomeDir = (name: string) => path.join(os.homedir(), name)

export const PAC_SERVER_STATE_FILE_PATH = inHomeDir('.lhmapper-pac-server-state')
export const PAC_STATE_FILE_PATH = inHomeDir('.lhmapper-pac-state')
export const NETWORK_BACKUP_FILE_PATH = inHomeDir('.lhmapper-network-backup')
export const CERTS_FILE_PATH = inHomeDir('.lhmapper-certs')
