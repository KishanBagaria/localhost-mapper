import boxen from 'boxen'
import chalk from 'chalk'
import * as console from '../console'

const AutoProxyConfig = {
  set(pacURL) {
    const msg = chalk`{red.bold Important!}
Automatic config for this platform isn't available.
To make the forwarding work, you have to manually
set your auto proxy config (PAC) URL to
{yellow.underline ${pacURL}}`

    console.log(boxen(msg, {
      borderColor: 'red', borderStyle: 'round', margin: 1, padding: 1, float: 'center'
    }))
  }
}
export default AutoProxyConfig
