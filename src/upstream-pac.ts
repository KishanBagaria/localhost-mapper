import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { getOriginalPACURL } from './network-config.js'
import * as console from './console.js'
import type { UpstreamPAC } from './types.js'

// Generous, because failing here silently drops you back to DIRECT for
// everything unmapped. Only paid once per process, and only when a PAC is
// actually configured.
const TIMEOUT_MS = 10_000
const MAX_BYTES = 1024 * 1024

const isDisabled = () => process.env.LOCALHOST_MAPPER_NO_PAC_CHAIN === '1'

async function download(url: string): Promise<string> {
  if (url.startsWith('file:')) return readFile(fileURLToPath(url), 'utf8')
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`responded with ${res.status}`)
  return res.text()
}

/**
 * A syntax error in the upstream source wouldn't just break the fallback — it
 * would fail to parse the whole generated PAC file and take every mapping with
 * it, so check before embedding. `new Function` compiles without running.
 */
function isUsable(source: string): boolean {
  if (source.length > MAX_BYTES) {
    console.error(`Ignoring the existing PAC file: larger than ${MAX_BYTES} bytes`)
    return false
  }
  if (!source.includes('FindProxyForURL')) {
    console.error("Ignoring the existing PAC file: it doesn't define FindProxyForURL")
    return false
  }
  try {
    new Function(source)
    return true
  } catch (err) {
    console.error('Ignoring the existing PAC file: it failed to parse —', (err as Error).message)
    return false
  }
}

async function load(): Promise<UpstreamPAC | null> {
  if (isDisabled()) return null
  const url = await getOriginalPACURL()
  if (!url) return null

  let source: string
  try {
    source = await download(url)
  } catch (err) {
    // Common and not fatal: corporate PAC URLs are often only reachable on VPN.
    console.error(`Couldn't read the existing PAC file at ${url} —`, (err as Error).message)
    return null
  }
  return isUsable(source) ? { url, source } : null
}

let pending: Promise<UpstreamPAC | null> | undefined

/**
 * The PAC file configured before localhost-mapper took over, so unmapped
 * requests can keep using it. Fetched at most once per process — the result is
 * a snapshot, not a live reference.
 */
export default function getUpstreamPAC(): Promise<UpstreamPAC | null> {
  pending ??= load()
  return pending
}
