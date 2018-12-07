import path from 'path'
import os from 'os'
import pkg from '../package.json'

export const PREFERRED_HTTP_PORT = 1122
export const VERSION = +pkg.version

export const PAC_SERVER_STATE_FILE_PATH = path.join(os.homedir(), '.lhmapper-pac-server-state')
export const PAC_STATE_FILE_PATH = path.join(os.homedir(), '.lhmapper-pac-state')
export const NETWORK_BACKUP_FILE_PATH = path.join(os.homedir(), '.lhmapper-network-backup')
export const CERTS_FILE_PATH = path.join(os.homedir(), '.lhmapper-certs')
