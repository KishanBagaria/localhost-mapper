import crypto from 'node:crypto'

/**
 * Short content hash used to bust the OS/browser cache of the PAC file:
 * a changed PAC yields a changed URL. Not security sensitive.
 */
const rev = (str: string): string =>
  crypto.createHash('sha256').update(str).digest('base64').replace(/[+/=]/g, 'x').slice(0, 10)

export default rev
