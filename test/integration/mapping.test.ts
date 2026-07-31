import test from 'ava'
import puppeteer from 'puppeteer'
import lhMapper, { runExitCleanup } from '../../dist/index.js'
import { createTestServer, createTestSecureServer } from '../helpers/server.js'

const TEST_STRING = "DON'T PANIC"
const PROTOCOLS = ['http', 'https'] as const

/**
 * Mappings are resolved by the OS proxy config, so only a real browser can see
 * them — plain HTTP clients ignore PAC files.
 */
async function getURLBody(address: string): Promise<string> {
  const browser = await puppeteer.launch({ acceptInsecureCerts: true })
  try {
    const page = await browser.newPage()
    await page.goto(address)
    return await page.evaluate(() => document.body.innerHTML)
  } finally {
    await browser.close()
  }
}

test.serial('runs test server', async t => {
  const { server, port } = await createTestServer(TEST_STRING)
  const res = await fetch(`http://localhost:${port}`)
  t.is(await res.text(), TEST_STRING)
  server.close()
})

for (const protocolA of PROTOCOLS) {
  const runServer = protocolA === 'https' ? createTestSecureServer : createTestServer
  for (const protocolB of PROTOCOLS) {
    test.serial(`maps local ${protocolA} to ${protocolB}`, async t => {
      const { server, port } = await runServer(TEST_STRING)
      const newAddress = `${protocolB}://test-basic.${protocolA}-${protocolB}/`
      await lhMapper.map(`${protocolA}://localhost:${port}`, newAddress)
      t.is(await getURLBody(newAddress), TEST_STRING)
      server.close()
    })
  }
}

test.serial('maps local http to punycode http', async t => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = 'http://test-🍔.🍔/'
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  t.is(await getURLBody(newAddress), TEST_STRING)
  server.close()
})

test.serial('maps local http to extended subdomain http', async t => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = 'http://test.a.lot.of.subdomains/'
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  t.is(await getURLBody(newAddress), TEST_STRING)
  server.close()
})

test.serial('maps http regex to http', async t => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = /http:\/\/test-regex-.*\//
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  for (const address of ['http://test-regex-foo', 'http://test-regex-bar']) {
    t.is(await getURLBody(address), TEST_STRING)
  }
  // The regex only covers http:, so the https variant must not resolve.
  await t.throwsAsync(getURLBody('https://test-regex-foo'))
  server.close()
})

test.serial('throws on catch-all regex', async t => {
  await t.throwsAsync(lhMapper.map('http://localhost', /http:\/\/.*\//))
})

for (const protocol of PROTOCOLS) {
  test.serial(`maps internet ${protocol} to ${protocol}`, async t => {
    const newAddress = `${protocol}://test-internet-${protocol}-${protocol}/`
    await lhMapper.map(`${protocol}://example.com/`, newAddress)
    t.true((await getURLBody(newAddress)).includes('Example Domain'))
  })
}

test.serial('maps multiple local addresses together', async t => {
  const { server, port } = await createTestSecureServer(TEST_STRING)
  const newAddresses = ['http://test-multiple-addresses-1/', 'https://test-multiple-addresses-2/']
  await lhMapper.map(`https://localhost:${port}`, newAddresses)
  for (const newAddress of newAddresses) {
    t.is(await getURLBody(newAddress), TEST_STRING)
  }
  server.close()
})

test.serial('removes normal mapped addresses', async t => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = 'http://test-remove/'
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  t.is(await getURLBody(newAddress), TEST_STRING)
  await lhMapper.unmap(newAddress)
  await t.throwsAsync(getURLBody(newAddress))
  server.close()
})

test.serial('removes regex mapped addresses', async t => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = /http:\/\/test-remove-regex.*\//
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  t.is(await getURLBody('http://test-remove-regex/'), TEST_STRING)
  await lhMapper.unmap(newAddress)
  await t.throwsAsync(getURLBody('http://test-remove-regex/'))
  server.close()
})

test.serial('throws on duplicates', async t => {
  const { server, port } = await createTestServer(TEST_STRING)
  await t.notThrowsAsync(lhMapper.map(`http://localhost:${port}`, 'http://test-duplicates/'))
  await t.throwsAsync(lhMapper.map(`http://localhost:${port}`, 'http://test-duplicates/'))
  server.close()
})

test.serial('maps http .dev link to https automatically', async t => {
  const { server, port } = await createTestServer(TEST_STRING)
  await lhMapper.map(`http://localhost:${port}`, 'http://test-dev-https.dev/')
  t.is(await getURLBody('http://test-dev-https.dev/'), TEST_STRING)
  t.is(await getURLBody('https://test-dev-https.dev/'), TEST_STRING)
  server.close()
})

test.serial('throws on invalid input', async t => {
  for (const invalid of [
    'http://',
    '/invalid',
    'http//invalid',
    'http://:invalid',
    'ftp://invalid'
  ]) {
    await t.throwsAsync(lhMapper.map('http://localhost', invalid), undefined, invalid)
    await t.throwsAsync(lhMapper.map(invalid, invalid), undefined, invalid)
    await t.throwsAsync(lhMapper.map(invalid, 'http://localhost'), undefined, invalid)
  }
})

test.after.always('cleanup', async () => {
  // AVA tears the process down without letting our exit hook run to completion.
  await runExitCleanup()
})
