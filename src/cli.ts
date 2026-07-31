import { parseArgs } from 'node:util'
import { readFile } from 'node:fs/promises'
import chalk from 'chalk'
import open from 'open'
import updateNotifier from 'update-notifier'
import lhMapper from './index.js'
import { PKG } from './constants.js'
import LocalhostMapperError from './errors.js'
import type { SSLCredentials } from './types.js'

const $ = chalk.gray('$')

const USAGE = `
  ${chalk.underline('Usage')}
    ${$} lh-map <original_address> <new_address> [options]

  ${chalk.underline('Options')}
    --regex       Treat <new_address> as a regular expression
    --open        Open new URL in default browser
    --no-proxy    Disable proxying

    --cert        File path of cert file to use for HTTPS
    --key         File path of key file to use for HTTPS

  ${chalk.underline('Examples')}
    ${$} lh-map http://localhost:1337  http://awesome-site
    ${$} lh-map http://localhost:31337 https://foo.bar.baz
`

const OPTIONS = {
  regex: { type: 'boolean' },
  open: { type: 'boolean' },
  // `allowNegative` turns `--no-proxy` into `proxy: false`.
  proxy: { type: 'boolean', default: true },
  cert: { type: 'string' },
  key: { type: 'string' },
  version: { type: 'boolean', short: 'v' },
  help: { type: 'boolean', short: 'h' }
} as const

function stringToRegExp(string: string): RegExp {
  const regexMatches = /\/(.*)\/(.*)/.exec(string)
  if (!regexMatches) throw new LocalhostMapperError(`"${string}" is an invalid regular expression`)
  const [, pattern = '', flags] = regexMatches
  return new RegExp(pattern, flags)
}

const fail = (message: string): void => {
  console.error(chalk.red('Error:'), message)
  process.exitCode = 1
}

async function readSSLCredentials(certPath: string, keyPath: string): Promise<SSLCredentials> {
  const [cert, key] = await Promise.all([readFile(certPath, 'utf8'), readFile(keyPath, 'utf8')])
  return { cert, key }
}

function parse() {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      options: OPTIONS,
      allowPositionals: true,
      allowNegative: true
    })
  } catch (err) {
    throw new LocalhostMapperError(`${(err as Error).message}\n${USAGE}`)
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parse()

  if (values.version) {
    console.log(PKG.version)
    return
  }

  const [originalAddress, rawNewAddress] = positionals
  if (values.help || !originalAddress || !rawNewAddress) {
    console.error(USAGE)
    if (!values.help) process.exitCode = 1
    return
  }

  const { cert: certPath, key: keyPath, regex, open: shouldOpen, proxy } = values

  if (Boolean(certPath) !== Boolean(keyPath)) {
    fail('You must specify both --cert and --key')
    return
  }
  if (certPath && !regex && rawNewAddress.startsWith('http:')) {
    fail('--cert and --key are specified but new_address is http:')
    return
  }

  const newAddress = regex ? stringToRegExp(rawNewAddress) : rawNewAddress
  const ssl = certPath && keyPath ? await readSSLCredentials(certPath, keyPath) : undefined

  updateNotifier({ pkg: PKG }).notify()

  await lhMapper.map(originalAddress, newAddress, { proxy, ssl })
  console.log(`\n    ${chalk.gray(originalAddress)} → ${chalk.yellow(rawNewAddress)}\n`)

  // Opening a regex isn't meaningful — there's no single URL to visit.
  if (shouldOpen && !regex) await open(rawNewAddress)
}

main().catch((err: unknown) => {
  if (err instanceof LocalhostMapperError) console.error(chalk.red(err.message))
  else console.error(err)
  process.exitCode = 1
})
