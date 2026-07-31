import { execa } from 'execa'
import * as console from '../console.js'
import type { AutoProxyConfig, DarwinBackupEntry } from '../types.js'

const NETWORK_SETUP_PATH = '/usr/sbin/networksetup'

const NetworkSetup = {
  async run(...args: string[]): Promise<string> {
    const { exitCode, stdout, stderr } = await execa(NETWORK_SETUP_PATH, args, { reject: false })
    if (exitCode !== 0) {
      console.error(`${NETWORK_SETUP_PATH} exited with code ${exitCode}\n`, stderr)
    }
    return stdout
  },

  async listAllNetworkServices(): Promise<string[]> {
    const stdout = await this.run('-listallnetworkservices')
    // The first line is a human-readable header, not a service.
    return stdout
      .split('\n')
      .slice(1)
      .map(line => line.trim())
      .filter(Boolean)
  },

  /** Parses the `Enabled: Yes` / `URL: (null)` block `-getautoproxyurl` prints. */
  async getAutoProxyURL(interfaceName: string): Promise<{ url: string | null; enabled: boolean }> {
    const stdout = await this.run('-getautoproxyurl', interfaceName)
    const fields: Record<string, string> = {}
    for (const line of stdout.split('\n')) {
      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) continue
      fields[line.slice(0, colonIndex).toLowerCase()] = line.slice(colonIndex + 2)
    }
    const url = fields.url
    return {
      url: !url || url === '(null)' ? null : url,
      enabled: fields.enabled === 'Yes'
    }
  },

  // networksetup treats an empty argument as an error, so clear with a space.
  setAutoProxyURL: (interfaceName: string, autoProxyURL: string | null) =>
    NetworkSetup.run('-setautoproxyurl', interfaceName, autoProxyURL || ' '),

  setAutoProxyState: (interfaceName: string, enabled: boolean) =>
    NetworkSetup.run('-setautoproxystate', interfaceName, enabled ? 'on' : 'off')
}

const AutoProxyConfigDarwin: AutoProxyConfig = {
  async set(autoProxyURL) {
    const services = await NetworkSetup.listAllNetworkServices()
    await Promise.all(
      services.map(async interfaceName => {
        await NetworkSetup.setAutoProxyURL(interfaceName, autoProxyURL)
        await NetworkSetup.setAutoProxyState(interfaceName, true)
      })
    )
  },

  async backup(): Promise<DarwinBackupEntry[]> {
    const services = await NetworkSetup.listAllNetworkServices()
    return Promise.all(
      services.map(async interfaceName => ({
        interfaceName,
        ...(await NetworkSetup.getAutoProxyURL(interfaceName))
      }))
    )
  },

  async restore(backup) {
    if (!Array.isArray(backup)) return
    // Sequential: networksetup misbehaves when several instances write at once.
    for (const { interfaceName, url, enabled } of backup) {
      await NetworkSetup.setAutoProxyURL(interfaceName, url)
      await NetworkSetup.setAutoProxyState(interfaceName, enabled)
    }
  }
}

export default AutoProxyConfigDarwin
