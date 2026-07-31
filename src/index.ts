import chalk from 'chalk'
import * as mappings from './mappings.js'
import * as console from './console.js'
import type { MapOptions, NewAddress } from './types.js'

if (process.env.NODE_ENV === 'production') {
  console.log(chalk.yellow('Warning!'), "localhost-mapper isn't meant to be used in production.")
}

/**
 * Forwards `originalAddress` to `newAddress`
 * (`http://localhost:1337` → `http://cat.meow`).
 */
export function map(
  originalAddress: string,
  newAddress: NewAddress,
  options: MapOptions = {}
): Promise<void> {
  return mappings.add({ originalAddress, newAddress, ...options })
}

/**
 * Stops listening for `newAddress`. All addresses are removed automatically
 * when the process exits.
 */
export function unmap(newAddress: NewAddress): Promise<void> {
  return mappings.remove({ newAddress })
}

export { map as add, unmap as remove }
export { runExitCleanup } from './exit-handler.js'
export type {
  MapOptions,
  NewAddress,
  NormalizedAddress,
  SSLCredentials
} from './types.js'

const lhMapper = { map, unmap, add: map, remove: unmap }

export default lhMapper
