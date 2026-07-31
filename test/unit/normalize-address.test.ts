import test from 'ava'
import normalizeAddress from '../../dist/util/normalize-address.js'

test('keeps protocol, host and a trailing-slash href', t => {
  t.deepEqual(normalizeAddress('http://awesome-site'), {
    protocol: 'http:',
    hostname: 'awesome-site',
    port: '',
    host: 'awesome-site',
    href: 'http://awesome-site/'
  })
})

test('keeps non-default ports', t => {
  const normalized = normalizeAddress('http://localhost:1337')
  t.is(normalized?.port, '1337')
  t.is(normalized?.host, 'localhost:1337')
  t.is(normalized?.href, 'http://localhost:1337/')
})

test('drops default ports', t => {
  t.is(normalizeAddress('http://cat.meow:80')?.href, 'http://cat.meow/')
  t.is(normalizeAddress('https://cat.meow:443')?.href, 'https://cat.meow/')
})

test('keeps a port that is default for the other protocol', t => {
  t.is(normalizeAddress('http://cat.meow:443')?.href, 'http://cat.meow:443/')
})

test('lowercases the host', t => {
  t.is(normalizeAddress('HTTP://Awesome-SITE')?.href, 'http://awesome-site/')
})

test('punycodes unicode hostnames, matching what browsers request', t => {
  t.is(normalizeAddress('http://🍔/')?.href, 'http://xn--ui8h/')
  t.is(normalizeAddress('http://test-🍔.🍔/')?.hostname, 'xn--test--uq93d.xn--ui8h')
})

test('discards the path, which PAC prefix matching ignores', t => {
  t.is(normalizeAddress('http://awesome-site/some/path?q=1')?.href, 'http://awesome-site/')
})

test('returns null for unparseable addresses', t => {
  for (const invalid of ['http://', '/invalid', 'http//invalid', 'http://:invalid', '']) {
    t.is(normalizeAddress(invalid), null, invalid)
  }
})

test('parses unsupported protocols rather than rejecting them', t => {
  // Rejecting ftp: is `mappings`' job, so that it can name the protocol.
  t.is(normalizeAddress('ftp://invalid')?.protocol, 'ftp:')
})
