import bluebird from 'bluebird'
import fse from 'fs-extra'
import selfSigned from 'selfsigned'
import { CERTS_FILE_PATH } from './constants'

bluebird.promisifyAll(selfSigned)

export const certsFile = {
  exists: () => fse.pathExists(CERTS_FILE_PATH),
  read: () => fse.readJSON(CERTS_FILE_PATH, { throws: false }),
  write: json => fse.writeJSON(CERTS_FILE_PATH, json),
  delete: () => fse.unlink(CERTS_FILE_PATH)
}

const cached = { key: undefined, cert: undefined }
async function getSelfSignedCerts() {
  if (cached.key) return cached
  if (await certsFile.exists()) {
    Object.assign(cached, await certsFile.read())
    return cached
  }

  const { private: key, cert } = await selfSigned.generateAsync([{ name: 'commonName', value: 'localhost-mapper' }], { days: 365, algorithm: 'sha256' })
  Object.assign(cached, { key, cert })
  await certsFile.write(cached)
  return cached
}

export default getSelfSignedCerts
