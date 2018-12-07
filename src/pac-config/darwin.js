import execa from 'execa'
import bluebird from 'bluebird'
import * as console from '../console'

const NETWORK_SETUP_PATH = '/usr/sbin/networksetup'

const NetworkSetup = {
  async run(...args) {
    const { code, stdout, stderr } = await execa(NETWORK_SETUP_PATH, args)
    if (code !== 0) {
      console.error(`${NETWORK_SETUP_PATH} exited with code ${code}\n`, stderr)
    }
    return stdout
  },
  async listAllNetworkServices() {
    const stdout = await this.run('-listallnetworkservices')
    return stdout.split('\n').slice(1)
  },
  async getAutoProxyURL(interfaceName) {
    const stdout = await this.run('-getautoproxyurl', interfaceName)
    const lines = stdout.split('\n')
    function getNormalizedValue(key, value) {
      if (key === 'enabled') return value === 'Yes'
      if (value === '(null)') return null
      return value
    }
    return Object.assign({}, ...lines.map((line) => {
      const colonIndex = line.indexOf(':')
      const key = line.slice(0, colonIndex).toLowerCase()
      const value = line.slice(colonIndex + 2)
      return { [key]: getNormalizedValue(key, value) }
    }))
  },
  setAutoProxyURL(interfaceName, autoProxyURL) {
    return this.run('-setautoproxyurl', interfaceName, autoProxyURL || ' ')
  },
  setAutoProxyState(interfaceName, state) {
    return this.run('-setautoproxystate', interfaceName, state ? 'on' : 'off')
  }
}

const AutoProxyConfig = {
  set(autoProxyURL) {
    bluebird.map(NetworkSetup.listAllNetworkServices(), async interfaceName => ({
      interfaceName,
      ...await NetworkSetup.setAutoProxyURL(interfaceName, autoProxyURL),
      ...await NetworkSetup.setAutoProxyState(interfaceName, true)
    }))
  },
  backup: () => bluebird.map(NetworkSetup.listAllNetworkServices(), async interfaceName => ({
    interfaceName,
    ...await NetworkSetup.getAutoProxyURL(interfaceName)
  })),
  restore: config => bluebird.map(config, async ({ interfaceName, url, enabled }) => {
    await NetworkSetup.setAutoProxyURL(interfaceName, url)
    await NetworkSetup.setAutoProxyState(interfaceName, enabled)
  }, { concurrency: 1 })
}
export default AutoProxyConfig
