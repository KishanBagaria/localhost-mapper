export default function isProcessRunning(pid) {
  try {
    return process.kill(pid, 0)
  } catch (err) {
    return err.code === 'EPERM'
  }
}
