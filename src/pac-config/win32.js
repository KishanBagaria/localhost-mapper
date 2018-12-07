import execa from 'execa'
import bluebird from 'bluebird'
import path from 'path'
import Registry from 'winreg'
import * as console from '../console'

const urlRegKey = new Registry({
  hive: Registry.HKCU,
  key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
})
bluebird.promisifyAll(urlRegKey)

const WINPROXY_PATH = path.join(__dirname, 'winproxy.exe')

const AutoProxyConfig = {
  async run(...args) {
    const { code, stdout, stderr } = await execa(WINPROXY_PATH, args)
    if (code !== 0) {
      console.error(`${WINPROXY_PATH} exited with code ${code}\n`, stderr)
    }
    return stdout
  },
  set(autoProxyURL) {
    // simply changing registry here doesn't notify browsers of the change
    return this.run('-autoproxy', autoProxyURL)
  },
  async backup() {
    return {
      url: await urlRegKey.valueExistsAsync('AutoConfigURL') ? urlRegKey.getAsync('AutoConfigURL') : null
    }
  },
  async restore({ url }) {
    if (url === null) await this.run('-autoproxy')
    else if (url) await this.run('-autoproxy', url)
  }
}

export default AutoProxyConfig
