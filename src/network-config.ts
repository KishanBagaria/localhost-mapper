import getAutoProxyConfig from './pac-config/index.js'
import jsonFile from './util/json-file.js'
import { NETWORK_BACKUP_FILE_PATH } from './constants.js'
import LocalhostMapperError from './errors.js'
import type { NetworkBackup } from './types.js'

const backupFile = jsonFile<NetworkBackup>(NETWORK_BACKUP_FILE_PATH)

let capturedOriginal: Promise<NetworkBackup> | undefined

/**
 * The proxy config from before localhost-mapper touched anything: the backup
 * file once we've written one, otherwise whatever is currently live. Reading the
 * live config is memoized, since it shells out once per network service.
 */
async function readOriginalConfig(): Promise<NetworkBackup | null> {
  const apc = await getAutoProxyConfig()
  if (!apc.backup) return null
  const saved = await backupFile.read()
  if (saved) return saved
  capturedOriginal ??= apc.backup()
  return capturedOriginal
}

/** A PAC URL of ours would make the generated file chain into itself. */
const isSelfHosted = (url: string): boolean => {
  const hostname = URL.parse(url)?.hostname
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

/**
 * The PAC URL configured before we took over, so the generated PAC file can
 * fall through to it. `null` when there wasn't one.
 */
export async function getOriginalPACURL(): Promise<string | null> {
  const config = await readOriginalConfig()
  if (!config) return null
  const urls = Array.isArray(config)
    ? config.filter(entry => entry.enabled).map(entry => entry.url)
    : [config.url]
  return urls.find(url => url && !isSelfHosted(url)) ?? null
}

/** Puts the OS proxy settings back the way we found them. */
export async function restoreBackup(): Promise<void> {
  const apc = await getAutoProxyConfig()
  if (!apc.restore) return
  const backup = await backupFile.read()
  if (!backup) return
  await apc.restore(backup)
  await backupFile.delete()
}

export default async function changeNetworkConfig(pacURL: string): Promise<void> {
  if (!URL.parse(pacURL)?.port) {
    throw new LocalhostMapperError(`Received invalid \`pacURL\`: ${pacURL}`)
  }
  const apc = await getAutoProxyConfig()
  // Back up only once — the first mapping captures the user's real settings,
  // and later ones would otherwise overwrite it with our own.
  if (apc.backup && !(await backupFile.exists())) {
    const original = await readOriginalConfig()
    if (original) await backupFile.write(original)
  }
  await apc.set(pacURL)
}
