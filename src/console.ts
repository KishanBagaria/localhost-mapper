import chalk from 'chalk'

const prefix = chalk.gray('[localhost-mapper]')

export const log = (...args: unknown[]) => console.log(prefix, ...args)
export const error = (...args: unknown[]) => console.error(prefix, ...args)
