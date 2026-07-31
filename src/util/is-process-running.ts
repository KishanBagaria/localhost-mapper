export default function isProcessRunning(pid: number | undefined): boolean {
  if (typeof pid !== 'number') return false
  try {
    return process.kill(pid, 0)
  } catch (err) {
    // EPERM means the process exists but belongs to another user.
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}
