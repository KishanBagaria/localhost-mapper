import fs from 'node:fs'
import fsp from 'node:fs/promises'

export interface JSONFile<T> {
  readonly path: string
  exists(): Promise<boolean>
  existsSync(): boolean
  /** Resolves to `null` when the file is missing or holds invalid JSON. */
  read(): Promise<T | null>
  readSync(): T | null
  write(value: T): Promise<void>
  writeSync(value: T): void
  delete(): Promise<void>
  deleteSync(): void
}

/** A tiny typed wrapper over a JSON state file on disk. */
export default function jsonFile<T>(path: string): JSONFile<T> {
  const parse = (contents: string): T | null => {
    try {
      return JSON.parse(contents) as T
    } catch {
      return null
    }
  }

  return {
    path,
    async exists() {
      try {
        await fsp.access(path)
        return true
      } catch {
        return false
      }
    },
    existsSync: () => fs.existsSync(path),
    async read() {
      try {
        return parse(await fsp.readFile(path, 'utf8'))
      } catch {
        return null
      }
    },
    readSync() {
      try {
        return parse(fs.readFileSync(path, 'utf8'))
      } catch {
        return null
      }
    },
    write: value => fsp.writeFile(path, JSON.stringify(value), 'utf8'),
    writeSync: value => fs.writeFileSync(path, JSON.stringify(value), 'utf8'),
    delete: () => fsp.rm(path, { force: true }),
    deleteSync: () => fs.rmSync(path, { force: true })
  }
}
