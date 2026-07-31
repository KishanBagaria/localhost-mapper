import vm from 'node:vm'
import test from 'ava'
import { buildPACFile } from '../../dist/pac-file.js'

const RULE = "if (url.indexOf('http://awesome-site/') === 0) return 'PROXY localhost:54321'"
const MAPPED = 'http://awesome-site/'
const OTHER = 'https://example.com/page'

/** Runs a generated PAC the way a browser would, and returns FindProxyForURL. */
function evaluate(pac: string): (url: string, host: string) => string {
  const context = vm.createContext({})
  vm.runInContext(pac, context)
  const fn = vm.runInContext('FindProxyForURL', context) as unknown
  if (typeof fn !== 'function') throw new TypeError('PAC did not define FindProxyForURL')
  return fn as (url: string, host: string) => string
}

const upstream = (source: string) => ({ url: 'https://pac.example.com', source })

test('produces nothing when there are no rules', t => {
  t.is(buildPACFile([]), '')
  t.is(buildPACFile([], upstream('function FindProxyForURL() { return "DIRECT" }')), '')
})

test('without an upstream, unmatched URLs go direct', t => {
  const findProxy = evaluate(buildPACFile([RULE]))
  t.is(findProxy(MAPPED, 'awesome-site'), 'PROXY localhost:54321')
  t.is(findProxy(OTHER, 'example.com'), 'DIRECT')
})

test('with an upstream, mappings win and everything else delegates', t => {
  const findProxy = evaluate(
    buildPACFile(
      [RULE],
      upstream("function FindProxyForURL(url, host) { return 'PROXY corporate:8080' }")
    )
  )
  t.is(findProxy(MAPPED, 'awesome-site'), 'PROXY localhost:54321')
  t.is(findProxy(OTHER, 'example.com'), 'PROXY corporate:8080')
})

test('the upstream receives the real url and host', t => {
  const findProxy = evaluate(
    buildPACFile(
      [RULE],
      upstream("function FindProxyForURL(url, host) { return 'PROXY ' + host + '|' + url }")
    )
  )
  t.is(findProxy(OTHER, 'example.com'), `PROXY example.com|${OTHER}`)
})

test('an upstream declaring FindProxyForURL cannot clobber ours', t => {
  // The upstream's declaration is scoped to the wrapper, not the global.
  const findProxy = evaluate(
    buildPACFile(
      [RULE],
      upstream("function FindProxyForURL(url, host) { return 'PROXY upstream:1' }")
    )
  )
  t.is(findProxy(MAPPED, 'awesome-site'), 'PROXY localhost:54321')
})

test('an upstream assigning the global implicitly cannot clobber ours', t => {
  // Sloppy-mode `FindProxyForURL = ...` writes to the global; ours is assigned last.
  const findProxy = evaluate(
    buildPACFile(
      [RULE],
      upstream("FindProxyForURL = function (url, host) { return 'PROXY upstream:2' }")
    )
  )
  t.is(findProxy(MAPPED, 'awesome-site'), 'PROXY localhost:54321')
  t.is(findProxy(OTHER, 'example.com'), 'PROXY upstream:2')
})

test('falls back to FindProxyForURLEx', t => {
  const findProxy = evaluate(
    buildPACFile([RULE], upstream("function FindProxyForURLEx(url, host) { return 'PROXY ex:3' }"))
  )
  t.is(findProxy(OTHER, 'example.com'), 'PROXY ex:3')
})

test('an upstream that throws at call time degrades to direct', t => {
  const findProxy = evaluate(
    buildPACFile(
      [RULE],
      upstream("function FindProxyForURL(url, host) { throw new Error('boom') }")
    )
  )
  t.is(findProxy(MAPPED, 'awesome-site'), 'PROXY localhost:54321')
  t.is(findProxy(OTHER, 'example.com'), 'DIRECT')
})

test('an upstream that throws while loading degrades to direct', t => {
  const findProxy = evaluate(buildPACFile([RULE], upstream("throw new Error('bad load')")))
  t.is(findProxy(MAPPED, 'awesome-site'), 'PROXY localhost:54321')
  t.is(findProxy(OTHER, 'example.com'), 'DIRECT')
})

test('an upstream defining nothing usable degrades to direct', t => {
  const findProxy = evaluate(buildPACFile([RULE], upstream('var unrelated = 1')))
  t.is(findProxy(OTHER, 'example.com'), 'DIRECT')
})

test('upstream helper globals stay reachable', t => {
  // PAC engines supply isPlainHostName, dnsDomainIs, etc. as globals.
  const context = vm.createContext({ isPlainHostName: (host: string) => !host.includes('.') })
  vm.runInContext(
    buildPACFile(
      [RULE],
      upstream(
        "function FindProxyForURL(url, host) { return isPlainHostName(host) ? 'DIRECT' : 'PROXY corp:1' }"
      )
    ),
    context
  )
  const findProxy = vm.runInContext('FindProxyForURL', context) as (u: string, h: string) => string
  t.is(findProxy('http://intranet/', 'intranet'), 'DIRECT')
  t.is(findProxy(OTHER, 'example.com'), 'PROXY corp:1')
})

test('the upstream url is recorded in a comment without breaking out', t => {
  const pac = buildPACFile([RULE], { url: 'https://pac.example.com\nvar injected = 1', source: '' })
  t.false(pac.includes('\nvar injected'))
  t.true(pac.includes('https://pac.example.com var injected = 1'))
})
