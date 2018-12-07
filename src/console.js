/* eslint-disable no-console */
import chalk from 'chalk'

const prefix = chalk.gray('[localhost-mapper]')

export const log = (...args) => console.log(prefix, ...args)
export const error = (...args) => console.error(prefix, ...args)
