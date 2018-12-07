export default class LocalhostMapperError extends Error {
  constructor(...args) {
    super(...args)
    this.name = 'LocalhostMapperError'
  }
}
