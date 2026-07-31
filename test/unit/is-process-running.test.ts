import test from 'ava'
import isProcessRunning from '../../dist/util/is-process-running.js'

test('detects this process', t => {
  t.true(isProcessRunning(process.pid))
})

test('reports an unused pid as not running', t => {
  // Above every platform's pid_max, so it can never be live.
  t.false(isProcessRunning(2 ** 30))
})

test('treats a missing pid as not running', t => {
  t.false(isProcessRunning(undefined))
})
