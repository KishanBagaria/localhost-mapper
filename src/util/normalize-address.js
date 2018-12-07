import url from 'url'

const isDefaultPort = ({ port, protocol }) =>
  (+port === 80 && protocol === 'http:') || (+port === 443 && protocol === 'https:')

export default function normalizeAddress(address) {
  if (address instanceof RegExp) return address
  const parsed = url.parse(address.toLowerCase())
  const port = isDefaultPort(parsed) ? null : parsed.port
  const host = `${parsed.hostname || ''}${port ? `:${port}` : ''}`
  const href = `${parsed.protocol ? `${parsed.protocol}//` : ''}${host}/`
  return { ...parsed, port, host, href }
}
