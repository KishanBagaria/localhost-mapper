import createProxy from './proxy-server.js'
import changeNetworkConfig from './network-config.js'
import pacManager from './pac-manager.js'
import normalizeAddress from './util/normalize-address.js'
import registerExitHandler from './exit-handler.js'
import LocalhostMapperError from './errors.js'
import { LOOPBACK_HOST } from './constants.js'
import type { ProxyHandle } from './proxy-server.js'
import type { MapOptions, NewAddress, NormalizedAddress } from './types.js'

interface CurrentMapping {
  line: string
  proxy?: ProxyHandle
}

/** Mappings owned by this process, keyed by target href (or regex source). */
export const currentMappings = new Map<string, CurrentMapping>()

type PACUpdate = { url: string } | null

export async function onUpdate(update: PACUpdate): Promise<void> {
  if (!update) return
  registerExitHandler()
  await changeNetworkConfig(update.url)
}

// Two unroutable URLs used to detect regexes so broad they'd swallow the
// user's entire internet traffic.
const RANDOM_URLS = [
  'http://www.rFKyyImv9bAFPG1JvB9PwwtpnYl4vJpd.com/V23sUk6iQ8hcPvpaIfSxJN1peSz24zpd',
  'https://www.rFKyyImv9bAFPG1JvB9PwwtpnYl4vJpd.com/V23sUk6iQ8hcPvpaIfSxJN1peSz24zpd'
]

function validateRegex(regex: RegExp): void {
  // Test against a stateless clone: `g`/`y` flags make `test` advance lastIndex.
  const stateless = new RegExp(regex.source, regex.flags.replace(/[gy]/g, ''))
  if (RANDOM_URLS.some(url => stateless.test(url))) {
    throw new LocalhostMapperError(
      `"${String(regex)}" appears to match internet traffic, you must fix the regex to not accidentally forward internet traffic`
    )
  }
}

function normalizeAndValidate(address: string): NormalizedAddress {
  const normalized = normalizeAddress(address)
  if (!normalized?.host) {
    throw new LocalhostMapperError(
      `"${address}" is not a valid address, expected something like http://awesome-site`
    )
  }
  if (!['http:', 'https:'].includes(normalized.protocol)) {
    throw new LocalhostMapperError(
      `"${address}" must be over http: or https:, ${normalized.protocol} is unsupported`
    )
  }
  return normalized
}

/** A validated destination: either a concrete address or a pattern to match. */
type Target = NormalizedAddress | RegExp

function resolveTargets(originalAddress: string, newAddress: NewAddress): Target[] {
  const addresses = Array.isArray(newAddress) ? newAddress : [newAddress]
  const targets: Target[] = []

  for (const address of addresses) {
    if (address instanceof RegExp) {
      validateRegex(address)
      targets.push(address)
      continue
    }
    if (address === originalAddress) {
      throw new LocalhostMapperError('`newAddress` and `originalAddress` cannot be the same')
    }
    const target = normalizeAndValidate(address)
    targets.push(target)

    // `.dev` is HSTS-preloaded, so browsers force HTTPS on it regardless of
    // what the user asked for. Map both so the address works either way.
    if (target.protocol === 'http:' && target.hostname.endsWith('.dev') && !target.port) {
      targets.push({ ...target, protocol: 'https:', href: `https://${target.host}/` })
    }
  }
  return targets
}

export async function add({
  originalAddress,
  newAddress,
  ssl,
  proxy = true,
  proxyConfig
}: { originalAddress: string; newAddress: NewAddress } & MapOptions): Promise<void> {
  if (typeof originalAddress !== 'string') {
    throw new TypeError(
      `Expected \`originalAddress\` to be a string, got ${typeof originalAddress}`
    )
  }
  if (
    typeof newAddress !== 'string' &&
    !Array.isArray(newAddress) &&
    !(newAddress instanceof RegExp)
  ) {
    throw new TypeError(
      `Expected \`newAddress\` to be a string, array or RegExp, got ${typeof newAddress}`
    )
  }

  const original = normalizeAndValidate(originalAddress)
  const targets = resolveTargets(originalAddress, newAddress)

  let update: PACUpdate = null
  for (const target of targets) {
    const isRegex = target instanceof RegExp
    const key = isRegex ? String(target) : target.href
    const isHTTPS = !isRegex && target.protocol === 'https:'

    const proxyHandle = proxy
      ? await createProxy(original.href, { ssl: ssl || isHTTPS, ...proxyConfig })
      : undefined
    const newHost = proxyHandle ? `${LOOPBACK_HOST}:${proxyHandle.port}` : original.host
    const line = isRegex
      ? `if (${key}.test(url)) return 'PROXY ${newHost}'`
      : `if (url.indexOf('${key}') === 0) return 'PROXY ${newHost}'`

    try {
      update = await pacManager.add({ pid: process.pid, line, to: key, from: original.href })
    } catch (err) {
      // Don't leak the listening proxy when the mapping is rejected.
      proxyHandle?.close()
      throw err
    }
    currentMappings.set(key, { line, proxy: proxyHandle })
  }
  await onUpdate(update)
}

export async function remove({ newAddress }: { newAddress: NewAddress }): Promise<void> {
  if (
    typeof newAddress !== 'string' &&
    !Array.isArray(newAddress) &&
    !(newAddress instanceof RegExp)
  ) {
    throw new TypeError(
      `Expected \`newAddress\` to be a string, array or RegExp, got ${typeof newAddress}`
    )
  }
  const addresses = Array.isArray(newAddress) ? newAddress : [newAddress]

  let update: PACUpdate = null
  for (const address of addresses) {
    const key = address instanceof RegExp ? String(address) : normalizeAddress(address)?.href
    const mapping = key ? currentMappings.get(key) : undefined
    if (!key || !mapping) {
      throw new LocalhostMapperError(`${String(address)} hasn't been mapped`)
    }
    mapping.proxy?.close()
    update = await pacManager.removeByLine(mapping.line)
    currentMappings.delete(key)
  }
  await onUpdate(update)
}

/** Drops every mapping this process owns. Runs on exit. */
export async function removeAll(): Promise<void> {
  await pacManager.removeByPID(process.pid)
  for (const { proxy } of currentMappings.values()) proxy?.close()
  currentMappings.clear()
}
