import jsonFile from './util/json-file.js'
import { CERTS_FILE_PATH } from './constants.js'
import type { SSLCredentials } from './types.js'

export const certsFile = jsonFile<SSLCredentials>(CERTS_FILE_PATH)

let cached: SSLCredentials | undefined

/**
 * Self-signed credentials shared by every HTTPS mapping, generated once and
 * cached on disk so concurrent processes reuse the same certificate. The file
 * is removed once the last mapping goes away.
 */
export default async function getSelfSignedCerts(): Promise<SSLCredentials> {
  if (cached) return cached

  const saved = await certsFile.read()
  if (saved?.key && saved.cert) {
    cached = saved
    return cached
  }

  // Imported lazily: selfsigned pulls in pkijs and costs ~30ms to load, which
  // every consumer would otherwise pay on `import 'localhost-mapper'` even
  // though only HTTPS mappings need it.
  const { generate } = await import('selfsigned')

  // selfsigned defaults to a 365-day validity window.
  const { private: key, cert } = await generate(
    [{ name: 'commonName', value: 'localhost-mapper' }],
    { algorithm: 'sha256' }
  )
  cached = { key, cert }
  await certsFile.write(cached)
  return cached
}
