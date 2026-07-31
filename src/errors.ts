/** Errors caused by bad input or a bad environment, reported without a stack trace. */
export default class LocalhostMapperError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LocalhostMapperError'
  }
}
