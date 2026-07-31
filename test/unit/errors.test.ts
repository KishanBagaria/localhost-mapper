import test from 'ava'
import LocalhostMapperError from '../../dist/errors.js'

test('is an Error with a recognisable name', t => {
  const err = new LocalhostMapperError('nope')
  t.true(err instanceof Error)
  t.true(err instanceof LocalhostMapperError)
  t.is(err.name, 'LocalhostMapperError')
  t.is(err.message, 'nope')
})

test('keeps the cause', t => {
  const cause = new Error('underlying')
  t.is(new LocalhostMapperError('wrapped', { cause }).cause, cause)
})
