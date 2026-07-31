import test from 'ava'
import rev from '../../dist/util/rev.js'

test('is deterministic', t => {
  t.is(rev('some pac contents'), rev('some pac contents'))
})

test('changes when the contents change', t => {
  t.not(rev('a'), rev('b'))
})

test('is short and safe to put in a URL path', t => {
  const hash = rev("function FindProxyForURL(url, host) { return 'DIRECT' }")
  t.is(hash.length, 10)
  t.regex(hash, /^[\w]+$/)
})
