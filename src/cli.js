/* eslint-disable no-console */
import minimist from 'minimist'
import chalk from 'chalk'
import fse from 'fs-extra'
import opn from 'opn'
import updateNotifier from 'update-notifier'
import lhMapper from './'
import pkg from '../package.json'
import LocalhostMapperError from './errors'

const USAGE = chalk`
  {underline Usage}
    {gray $} lh-map <original_address> <new_address> [options]

  {underline Options}
    --regex       Treat <new_address> as a regular expression
    --open        Open new URL in default browser
    --no-proxy    Disable proxying

    --cert        File path of cert file to use for HTTPS
    --key         File path of key file to use for HTTPS

  {underline Examples}
    {gray $} lh-map http://localhost:1337  http://awesome-site
    {gray $} lh-map http://localhost:31337 https://foo.bar.baz
`

function stringToRegExp(string) {
  const regexMatches = /\/(.*)\/(.*)/.exec(string)
  if (!regexMatches) throw new LocalhostMapperError(`"${string}" is an invalid regular expression`)
  const [, pattern, flags] = regexMatches
  return new RegExp(pattern, flags)
}

async function main() {
  const unknown = new Set()
  const argv = minimist(process.argv.slice(2), {
    boolean: ['regex', 'open', 'no-proxy', 'version'],
    string: ['cert', 'key'],
    alias: { v: 'version' },
    unknown(arg) {
      if (arg.startsWith('-') && arg !== '--no-proxy') unknown.add(arg)
    }
  })
  const { cert: certPath, key: keyPath, regex, open, version, proxy } = argv
  const [origAddress, _newAddress] = argv._
  const newAddress = regex ? stringToRegExp(_newAddress) : _newAddress
  if (version) {
    console.log(pkg.version)
    return
  }
  if (!origAddress || !newAddress) {
    console.error(USAGE)
    return
  }
  updateNotifier({ pkg }).notify()
  unknown.forEach(arg => console.log(chalk`{yellow Warning:} ${arg} is unknown`))
  const options = { proxy, ssl: undefined }
  if (certPath || keyPath) {
    if (certPath && keyPath) {
      if (newAddress.startsWith('http:')) {
        console.error(chalk`{red Error:} --cert and --key are specified but new_address is http:`)
        return
      }
      const [cert, key] = await Promise.all([
        fse.readFile(certPath, 'utf-8'),
        fse.readFile(keyPath, 'utf-8')
      ])
      options.ssl = { cert, key }
    } else {
      console.error(chalk`{red Error:} You must specify both --cert and --key`)
      return
    }
  }
  await lhMapper.map(origAddress, newAddress, options)
  console.log(chalk`
    {gray ${origAddress}} → {yellow ${newAddress}}
`)
  if (open) await opn(newAddress)
}
main().catch((err) => {
  if (err.name === 'LocalhostMapperError') console.error(chalk.red(err.message))
  else console.error(err)
})
