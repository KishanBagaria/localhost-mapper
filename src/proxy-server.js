import net from 'net'
import http from 'http'
import httpProxy from 'http-proxy'
import getPort from 'get-port'
import getSelfSignedCerts from './certs'
import * as console from './console'

const connectProxy = targetPort => (req, socket) => {
  const httpsProxy = net.connect(targetPort)
  socket.pipe(httpsProxy).pipe(socket)

  function onError() {
    socket.destroy()
    httpsProxy.destroy()
  }
  httpsProxy.on('error', onError)
  socket.on('error', onError)

  socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
}

export default async function ProxyServer(target, options = {}) {
  const proxyServer = httpProxy.createProxyServer({
    target,
    ws: true,
    changeOrigin: true,
    secure: false,
    ...options,
    ssl: options.ssl === true ? await getSelfSignedCerts() : options.ssl
  })
  proxyServer.on('error', (e) => {
    console.error('An error occurred while proxying', target, e.message, e.code)
  })
  const port = await getPort(options.port)
  const anotherPort = options.ssl && await getPort()
  return new Promise((resolve) => {
    if (options.ssl) {
      const connectServer = http.createServer()
      connectServer.unref()
      connectServer.on('connect', connectProxy(anotherPort))
      connectServer.listen(port)
      const server = proxyServer.listen(anotherPort, () => resolve({ port, server }))
    } else {
      const server = proxyServer.listen(port, () => resolve({ port, server }))
    }
  })
}
