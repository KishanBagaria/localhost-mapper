const express = require('express')
const https = require('https')
const bluebird = require('bluebird')
const getPort = require('get-port')
const selfSigned = require('selfsigned')

bluebird.promisifyAll(selfSigned)

async function createTestServer(string) {
  const port = await getPort()
  const app = express()
  app.use((req, res) => res.send(string))
  return new Promise((resolve) => {
    const server = app.listen(port, () => resolve({ port, server }))
  })
}
async function createTestSecureServer(string) {
  const { cert, private: key } = await selfSigned.generateAsync([{ name: 'commonName', value: 'localhost-mapper-test' }], { days: 1, algorithm: 'sha256' })
  const port = await getPort()
  const app = express()
  app.use((req, res) => res.send(string))
  return new Promise((resolve) => {
    const server = https
      .createServer({ key, cert }, app)
      .listen(port, () => resolve({ port, server }))
  })
}

module.exports = { createTestServer, createTestSecureServer }
