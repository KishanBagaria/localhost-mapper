import fse from 'fs-extra'
import { PAC_SERVER_STATE_FILE_PATH } from './constants'

const pacServerState = {
  exists: () => fse.pathExists(PAC_SERVER_STATE_FILE_PATH),
  existsSync: () => fse.pathExistsSync(PAC_SERVER_STATE_FILE_PATH),
  read: () => fse.readJSON(PAC_SERVER_STATE_FILE_PATH, { throws: false }),
  readSync: () => fse.readJSONSync(PAC_SERVER_STATE_FILE_PATH, { throws: false }),
  write: json => fse.writeJSON(PAC_SERVER_STATE_FILE_PATH, json),
  writeSync: json => fse.writeJSONSync(PAC_SERVER_STATE_FILE_PATH, json),
  delete: () => fse.unlink(PAC_SERVER_STATE_FILE_PATH),
  deleteSync: () => fse.unlinkSync(PAC_SERVER_STATE_FILE_PATH)
}
export default pacServerState
