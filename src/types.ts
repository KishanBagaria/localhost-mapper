import type { ServerOptions } from 'http-proxy-3'

/** A URL reduced to the parts localhost-mapper cares about, with default ports dropped. */
export interface NormalizedAddress {
  protocol: string
  hostname: string
  /** Empty string when the port is absent or is the protocol's default. */
  port: string
  /** `hostname`, plus `:port` when non-default. */
  host: string
  /** Always `${protocol}//${host}/` — the prefix PAC lookups are matched against. */
  href: string
}

/** Contents (not paths) of a key/cert pair. */
export interface SSLCredentials {
  key: string
  cert: string
}

export interface MapOptions {
  /**
   * Proxy the response so the `Host` header reaches the original server unchanged.
   * @default true
   */
  proxy?: boolean
  /** Passed through to http-proxy-3. Ignored when `proxy` is `false`. */
  proxyConfig?: ServerOptions
  /** `true` generates self-signed certificates; pass credentials to use your own. */
  ssl?: SSLCredentials | boolean
}

/** The new address(es) to listen on. */
export type NewAddress = string | string[] | RegExp

export interface DarwinBackupEntry {
  interfaceName: string
  url: string | null
  enabled: boolean
}

export interface Win32Backup {
  url: string | null
}

export type NetworkBackup = DarwinBackupEntry[] | Win32Backup

/** Per-platform strategy for pointing the OS at our PAC file. */
export interface AutoProxyConfig {
  set(pacURL: string): Promise<void>
  /** Absent on platforms where the proxy config cannot be read back. */
  backup?(): Promise<NetworkBackup>
  restore?(backup: NetworkBackup): Promise<void>
}

/** A snapshot of the PAC file that was configured before we took over. */
export interface UpstreamPAC {
  url: string
  source: string
}

/** One `if (...) return 'PROXY host:port'` line of the generated PAC file. */
export interface PACEntry {
  /** The process that owns this mapping; entries of dead processes get pruned. */
  pid: number
  line: string
  to: string
}

export interface PACState {
  version: string
  ifs: PACEntry[]
}

export interface PACServerState {
  version: string
  pid: number
  port: number
}
