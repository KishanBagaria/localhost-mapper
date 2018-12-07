import test from 'ava'

import got from 'got'
import puppeteer from 'puppeteer'
import lhMapper from '../lib'
import { exitHandler } from '../lib/exit-handler'
import { createTestServer, createTestSecureServer } from './helpers/server'

const TEST_STRING = "DON'T PANIC"
const PROTOCOLS = ['http', 'https']

async function getURLBody(address) {
  let browser
  try {
    browser = await puppeteer.launch({ ignoreHTTPSErrors: true })
    const page = await browser.newPage()
    await page.goto(address)
    return await page.evaluate(() => document.body.innerHTML)
  } finally {
    await browser.close()
  }
}

test.serial('runs test server', async (t) => {
  const { server, port } = await createTestServer(TEST_STRING)
  const { body } = await got(`http://localhost:${port}`)
  t.deepEqual(body, TEST_STRING)
  server.close()
})

for (const protocolA of PROTOCOLS) {
  const runServer = protocolA === 'https' ? createTestSecureServer : createTestServer
  for (const protocolB of PROTOCOLS) {
    test.serial(`maps local ${protocolA} to ${protocolB}`, async (t) => {
      const { server, port } = await runServer(TEST_STRING)
      const newAddress = `${protocolB}://test-basic.${protocolA}-${protocolB}/`
      await lhMapper.map(`${protocolA}://localhost:${port}`, newAddress)
      t.deepEqual(TEST_STRING, await getURLBody(newAddress))
      server.close()
    })
  }
}
test.serial('maps local http to punycode http', async (t) => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = 'http://test-🍔.🍔/'
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  t.deepEqual(TEST_STRING, await getURLBody(newAddress))
  server.close()
})
test.serial('maps local http to extended subdomain http', async (t) => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = 'http://test.a.lot.of.subdomains/'
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  t.deepEqual(TEST_STRING, await getURLBody(newAddress))
  server.close()
})

test.serial('maps http regex to http', async (t) => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = /http:\/\/test-regex-.*\//
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  const addresses = [
    'http://test-regex-foo',
    'http://test-regex-bar'
  ]
  await Promise.all(addresses
    .map(async address =>
      t.deepEqual(TEST_STRING, await getURLBody(address))))
  await t.throws(getURLBody(addresses[0].replace('http:', 'https:')))
  server.close()
})
test.serial(
  'throws on catch-all regex',
  t => t.throws(lhMapper.map('http://localhost', /http:\/\/.*\//))
)

for (const protocol of PROTOCOLS) {
  test.serial(`maps internet ${protocol} to ${protocol}`, async (t) => {
    const newAddress = `${protocol}://test-internet-${protocol}-${protocol}/`
    await lhMapper.map(`${protocol}://httpbin.org/`, newAddress)
    t.true((await getURLBody(`${newAddress}/get?${TEST_STRING}`)).includes(TEST_STRING))
  })
}

test.serial('maps multiple local addresses together', async (t) => {
  const { server, port } = await createTestSecureServer(TEST_STRING)
  const newAddresses = ['http://test-multiple-addresses-1/', 'https://test-multiple-addresses-2/']
  await lhMapper.map(`https://localhost:${port}`, newAddresses)
  for (const newAddress of newAddresses) {
    t.deepEqual(TEST_STRING, await getURLBody(newAddress))
  }
  server.close()
})

test.serial('removes normal mapped addresses', async (t) => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = 'http://test-remove/'
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  t.deepEqual(TEST_STRING, await getURLBody(newAddress))
  await lhMapper.remove(newAddress)
  await t.throws(getURLBody(newAddress))
  server.close()
})
test.serial('removes regex mapped addresses', async (t) => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = /http:\/\/test-remove-regex.*\//
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  t.deepEqual(TEST_STRING, await getURLBody('http://test-remove-regex/'))
  await lhMapper.remove(newAddress)
  await t.throws(getURLBody('http://test-remove-regex/'))
  server.close()
})

test.serial('throws on duplicates', async (t) => {
  const { server, port } = await createTestServer(TEST_STRING)
  const result = lhMapper.map(`http://localhost:${port}`, 'http://test-duplicates/')
  await t.notThrows(result)
  const duplicateResult = lhMapper.map(`http://localhost:${port}`, 'http://test-duplicates/')
  await t.throws(duplicateResult)
  server.close()
})

test.serial('maps http .dev link to https automatically', async (t) => {
  const { server, port } = await createTestServer(TEST_STRING)
  const newAddress = 'http://test-dev-https.dev/'
  const newAddressSecure = 'https://test-dev-https.dev/'
  await lhMapper.map(`http://localhost:${port}`, newAddress)
  t.deepEqual(TEST_STRING, await getURLBody(newAddress))
  t.deepEqual(TEST_STRING, await getURLBody(newAddressSecure))
  server.close()
})

test.serial('throws on invalid input', async (t) => {
  for (const invalidAddress of ['http://', '/invalid', 'http//invalid', 'http://:invalid', 'ftp://invalid']) {
    await t.throws(lhMapper.map('http://localhost', invalidAddress))
    await t.throws(lhMapper.map(invalidAddress, invalidAddress))
    await t.throws(lhMapper.map(invalidAddress, 'http://localhost'))
  }
})

test.after.always('cleanup', async () => {
  // exit handler doesn't automatically run when using ava
  const noop = () => null
  await exitHandler(noop)
})
