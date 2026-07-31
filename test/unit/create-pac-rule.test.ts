import test from 'ava'
import vm from 'node:vm'
import createPACRule from '../../src/util/create-pac-rule.js'

function evaluate(rule: string, url: string): string {
  return vm.runInNewContext(`(() => { ${rule}; return 'DIRECT' })()`, { url }) as string
}

test('serializes a hostname instead of injecting it into PAC code', t => {
  const hostileAddress = "http://x'),0+!('y/"
  const rule = createPACRule(hostileAddress, 'localhost:54321')

  t.is(evaluate(rule, hostileAddress), 'PROXY localhost:54321')
  t.is(evaluate(rule, 'https://unrelated.example/'), 'DIRECT')
})

test('serializes the proxy destination', t => {
  const rule = createPACRule('http://mapped/', "proxy'; return 'PROXY attacker:1")

  t.is(evaluate(rule, 'http://mapped/'), "PROXY proxy'; return 'PROXY attacker:1")
  t.is(evaluate(rule, 'https://unrelated.example/'), 'DIRECT')
})

test('serializes regular expressions instead of embedding executable source', t => {
  const rule = createPACRule(/^https?:\/\/mapped\//i, 'localhost:54321')

  t.is(evaluate(rule, 'HTTP://MAPPED/path'), 'PROXY localhost:54321')
  t.is(evaluate(rule, 'https://unrelated.example/'), 'DIRECT')
})

test('escapes JavaScript line separators for older PAC engines', t => {
  const address = 'http://mapped/\u2028next'
  const rule = createPACRule(address, 'localhost:54321')

  t.false(rule.includes('\u2028'))
  t.true(rule.includes('\\u2028'))
  t.is(evaluate(rule, address), 'PROXY localhost:54321')
})
