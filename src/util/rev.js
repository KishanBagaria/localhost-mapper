import crypto from 'crypto'

const rev = str =>
  crypto.createHash('md5').update(str).digest('base64').replace(/[+/=]/g, 'x')
    .slice(0, 10)

export default rev
