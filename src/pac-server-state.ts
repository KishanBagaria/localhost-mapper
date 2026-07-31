import jsonFile from './util/json-file.js'
import { PAC_SERVER_STATE_FILE_PATH } from './constants.js'
import type { PACServerState } from './types.js'

/** Where the running PAC server advertises its pid and port. */
const pacServerStateFile = jsonFile<PACServerState>(PAC_SERVER_STATE_FILE_PATH)

export default pacServerStateFile
