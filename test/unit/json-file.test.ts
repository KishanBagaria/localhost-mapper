import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import test from 'ava'
import jsonFile from '../../dist/util/json-file.js'

const tempPath = () => path.join(os.tmpdir(), `lhmapper-test-${crypto.randomUUID()}.json`)

test('round-trips a value', async t => {
  const file = jsonFile<{ pid: number }>(tempPath())
  t.false(await file.exists())

  await file.write({ pid: 42 })
  t.true(await file.exists())
  t.deepEqual(await file.read(), { pid: 42 })

  await file.delete()
  t.false(await file.exists())
})

test('round-trips synchronously', t => {
  const file = jsonFile<{ port: number }>(tempPath())
  file.writeSync({ port: 1122 })
  t.true(file.existsSync())
  t.deepEqual(file.readSync(), { port: 1122 })
  file.deleteSync()
  t.false(file.existsSync())
})

test('reads a missing file as null', async t => {
  const file = jsonFile(tempPath())
  t.is(await file.read(), null)
  t.is(file.readSync(), null)
})

test('reads invalid JSON as null instead of throwing', async t => {
  const file = jsonFile(tempPath())
  await fs.writeFile(file.path, 'not json{', 'utf8')
  t.is(await file.read(), null)
  t.is(file.readSync(), null)
  await file.delete()
})

test('deleting a missing file is a no-op', async t => {
  const file = jsonFile(tempPath())
  await t.notThrowsAsync(file.delete())
  t.notThrows(() => {
    file.deleteSync()
  })
})
