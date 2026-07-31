import type { NormalizedAddress } from '../types.js'

/**
 * Reduces an address to the parts PAC matching needs.
 *
 * `URL` already lowercases the scheme, punycodes unicode hostnames
 * (`http://🍔/` → `http://xn--ui8h/`) and drops default ports, so the result is
 * directly comparable against the URLs a browser hands to `FindProxyForURL`.
 *
 * Returns `null` for anything `URL` can't parse.
 */
export default function normalizeAddress(address: string): NormalizedAddress | null {
  const url = URL.parse(address)
  if (!url) return null
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    host: url.host,
    href: `${url.protocol}//${url.host}/`
  }
}
