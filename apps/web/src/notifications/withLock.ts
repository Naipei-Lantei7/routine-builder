// Runs `task` while holding a lock shared by every tab of this site, so only
// one tab at a time can check and mark reminders. Without Web Locks support,
// runs it directly and accepts a rare duplicate (Plan 001, section 5.6).
export async function withLock(name: string, task: () => void | Promise<void>): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    await navigator.locks.request(name, async () => {
      await task()
    })
    return
  }
  await task()
}
