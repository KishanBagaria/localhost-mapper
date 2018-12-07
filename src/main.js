import chalk from 'chalk'
import * as mappings from './mappings'
import * as console from './console'

const { NODE_ENV } = process.env

if (NODE_ENV === 'production') {
  console.log(chalk`{yellow Warning!} localhost-mapper isn't meant to be used in production.`)
}

const lhMapper = {}

lhMapper.map = (originalAddress, newAddress, opts = {}) =>
  mappings.add({ originalAddress, newAddress, ...opts })

lhMapper.unmap = newAddress =>
  mappings.remove({ newAddress })

lhMapper.add = lhMapper.map
lhMapper.remove = lhMapper.unmap

export default lhMapper
