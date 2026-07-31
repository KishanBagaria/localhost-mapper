import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import Registry from 'winreg'
import * as console from '../console.js'
import type { AutoProxyConfig, Win32Backup } from '../types.js'

const WINPROXY_PATH = fileURLToPath(new URL('../../vendor/winproxy.exe', import.meta.url))

const internetSettings = new Registry({
  hive: Registry.HKCU,
  key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
})

/** Resolves to `null` when the value is absent, which is how winreg reports it. */
const readAutoConfigURL = (): Promise<string | null> =>
  new Promise(resolve => {
    internetSettings.get('AutoConfigURL', (err, item) => {
      resolve(err || !item?.value ? null : item.value)
    })
  })

async function winproxy(...args: string[]): Promise<string> {
  const { exitCode, stdout, stderr } = await execa(WINPROXY_PATH, args, { reject: false })
  if (exitCode !== 0) {
    console.error(`${WINPROXY_PATH} exited with code ${exitCode}\n`, stderr)
  }
  return stdout
}

const AutoProxyConfigWin32: AutoProxyConfig = {
  async set(autoProxyURL) {
    // Writing the registry directly doesn't notify running browsers of the
    // change, so go through winproxy.exe instead.
    await winproxy('-autoproxy', autoProxyURL)
  },

  async backup(): Promise<Win32Backup> {
    return { url: await readAutoConfigURL() }
  },

  async restore(backup) {
    if (Array.isArray(backup)) return
    // No URL means auto-proxy was off before we touched it; clear it again.
    await (backup.url ? winproxy('-autoproxy', backup.url) : winproxy('-autoproxy'))
  }
}

export default AutoProxyConfigWin32
