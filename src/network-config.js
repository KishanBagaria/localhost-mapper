import url from 'url'
import fse from 'fs-extra'
import AutoProxyConfig from './pac-config'
import { NETWORK_BACKUP_FILE_PATH } from './constants'
import LocalhostMapperError from './errors'

const BackupFile = {
  exists: () => fse.pathExists(NETWORK_BACKUP_FILE_PATH),
  read: () => fse.readJSON(NETWORK_BACKUP_FILE_PATH),
  write: json => fse.writeJSON(NETWORK_BACKUP_FILE_PATH, json),
  delete: () => fse.unlink(NETWORK_BACKUP_FILE_PATH)
}

export async function restoreBackup() {
  const apc = await AutoProxyConfig
  if (!apc.backup) return
  if (!await BackupFile.exists()) return
  const json = await BackupFile.read()
  await apc.restore(json)
  await BackupFile.delete()
}

export default async function changeNetworkConfig(pacURL) {
  const parsedURL = url.parse(pacURL)
  if (!parsedURL.port) throw new LocalhostMapperError(`Received invalid \`pacURL\`: ${pacURL}`)
  const apc = await AutoProxyConfig
  if (apc.backup && !await BackupFile.exists()) {
    await BackupFile.write(await apc.backup())
  }
  await apc.set(pacURL)
}
