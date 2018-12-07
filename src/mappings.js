import ProxyServer from './proxy-server'
import changeNetworkConfig from './network-config'
import pacManager from './pac-manager'
import normalizeAddress from './util/normalize-address'
import registerExitHandler from './exit-handler'
import LocalhostMapperError from './errors'

export const currentMappings = {}

export async function onUpdate(pacState) {
  if (!pacState) return
  registerExitHandler()
  await changeNetworkConfig(pacState.url)
}
const RANDOM_URLS = [
  'http://www.rFKyyImv9bAFPG1JvB9PwwtpnYl4vJpd.com/V23sUk6iQ8hcPvpaIfSxJN1peSz24zpd',
  'https://www.rFKyyImv9bAFPG1JvB9PwwtpnYl4vJpd.com/V23sUk6iQ8hcPvpaIfSxJN1peSz24zpd'
]
function validateHost(normalized, original) {
  if (original instanceof RegExp) {
    if (original.test(RANDOM_URLS[0]) || original.test(RANDOM_URLS[1])) {
      throw new LocalhostMapperError(`"${original}" appears to match internet traffic, you must fix the regex to not accidentally forward internet traffic`)
    }
    return
  }
  if (!normalized.protocol) {
    throw new LocalhostMapperError(`"${original}" must specify a protocol`)
  }
  if (!normalized.host) {
    throw new LocalhostMapperError(`"${original}" must specify a host`)
  }
  if (!['http:', 'https:'].includes(normalized.protocol)) {
    throw new LocalhostMapperError(`"${original}" must be over http: or https:, ${normalized.protocol} is unsupported`)
  }
}
export async function add({
  originalAddress, newAddress: _newAddress, ssl, proxy = true, proxyConfig
}) {
  if (typeof originalAddress !== 'string') {
    throw TypeError(`Expected \`originalAddress\` to be string, got ${typeof from}`)
  }
  const isRegex = _newAddress instanceof RegExp
  if (typeof _newAddress !== 'string' && !Array.isArray(_newAddress) && !isRegex) {
    throw TypeError(`Expected \`newAddress\` to be string, array or RegExp, got ${typeof _newAddress}`)
  }
  const newAddresses = Array.isArray(_newAddress) ? _newAddress : [_newAddress]
  const maps = []
  for (const newAddress of newAddresses) {
    if (originalAddress === newAddress) throw new LocalhostMapperError('`newAddress` and `originalAddress` cannot be the same')
    const normalizedNew = normalizeAddress(newAddress)
    const normalizedOriginal = normalizeAddress(originalAddress)
    validateHost(normalizedNew, newAddress)
    validateHost(normalizedOriginal, originalAddress)
    maps.push({ normalizedOriginal, normalizedNew })
    if (!isRegex && normalizedNew.hostname.endsWith('.dev') && !normalizedNew.port) {
      maps.push({ normalizedOriginal, normalizedNew: normalizeAddress(normalizedNew.href.replace(/^http/, 'https')) })
    }
  }
  let pacState
  for (const { normalizedOriginal, normalizedNew } of maps) {
    const { href: newHref = normalizedNew } = normalizedNew
    const isHTTPS = normalizedNew.protocol === 'https:'
    const proxyServer = proxy &&
      await ProxyServer(normalizedOriginal.href, { ssl: ssl || isHTTPS, ...proxyConfig })
    const newHost = proxy ? `localhost:${proxyServer.port}` : normalizedOriginal.host
    const line = isRegex
      ? `if (${_newAddress}.test(url)) return 'PROXY ${newHost}'`
      : `if (url.indexOf('${newHref}') === 0) return 'PROXY ${newHost}'`
    currentMappings[newHref] = { line, proxyServer }
    pacState = await pacManager.add({
      pid: process.pid, line, to: newHref.toString(), from: normalizedOriginal.href
    })
  }
  await onUpdate(pacState)
}
export async function remove({ newAddress: _newAddress }) {
  const isRegex = _newAddress instanceof RegExp
  if (typeof _newAddress !== 'string' && !Array.isArray(_newAddress) && !isRegex) {
    throw TypeError(`Expected \`_newAddress\` to be string, array or RegExp, got ${typeof _newAddress}`)
  }
  const newAddresses = Array.isArray(_newAddress) ? _newAddress : [_newAddress]
  let pacState
  for (const newAddress of newAddresses) {
    const { href: newHref = newAddress } = normalizeAddress(newAddress)
    if (!currentMappings[newHref]) throw new LocalhostMapperError(`${newAddress} hasn't been mapped`)
    const { line, proxyServer } = currentMappings[newHref]
    if (proxyServer) proxyServer.server.close()
    pacState = await pacManager.removeByLine(line)
    delete currentMappings[newHref]
  }
  await onUpdate(pacState)
}
export async function removeAll() {
  await pacManager.removeByPID(process.pid)
  Object.values(currentMappings)
    .forEach(({ proxyServer }) => proxyServer && proxyServer.server.close())
}
