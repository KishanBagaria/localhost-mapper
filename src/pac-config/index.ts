import type { AutoProxyConfig } from '../types.js'

let cached: Promise<AutoProxyConfig> | undefined

const load = async (): Promise<AutoProxyConfig> => {
  switch (process.platform) {
    case 'darwin':
      return (await import('./darwin.js')).default
    case 'win32':
      return (await import('./win32.js')).default
    default:
      return (await import('./unsupported.js')).default
  }
}

/** Resolves the proxy-config strategy for the current platform, loaded once. */
export default function getAutoProxyConfig(): Promise<AutoProxyConfig> {
  cached ??= load()
  return cached
}
