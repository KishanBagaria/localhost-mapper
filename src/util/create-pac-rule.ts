/**
 * Builds a PAC rule without treating addresses or regular expressions as code.
 *
 * PAC files are JavaScript, so every caller-controlled value must cross the
 * code/data boundary as a serialized string literal.
 */
function serialize(value: string): string {
  // U+2028 and U+2029 are valid JSON but terminate string literals in older
  // JavaScript engines, including ones that may be used to evaluate PAC files.
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export default function createPACRule(target: string | RegExp, proxyHost: string): string {
  const proxy = serialize(`PROXY ${proxyHost}`)
  if (target instanceof RegExp) {
    const source = serialize(target.source)
    const flags = serialize(target.flags)
    return `if (new RegExp(${source}, ${flags}).test(url)) return ${proxy}`
  }
  return `if (url.indexOf(${serialize(target)}) === 0) return ${proxy}`
}
