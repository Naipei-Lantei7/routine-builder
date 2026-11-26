export type PermissionState = NotificationPermission | 'unsupported'

export function getPermission(): PermissionState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

// Must be called from a user action (a click): browsers block or penalise
// permission prompts that appear on their own.
export async function requestPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export interface SystemNotification {
  title: string
  body: string
  // Notifications with the same tag replace each other instead of stacking.
  tag: string
  onClick: () => void
}

// Shows an OS notification. Returns false when it cannot be shown, so the
// caller can fall back to an in-app message. (Chrome on Android, for example,
// only allows notifications from a service worker and throws here.)
export function showSystemNotification({ title, body, tag, onClick }: SystemNotification): boolean {
  if (getPermission() !== 'granted') return false
  try {
    const notification = new Notification(title, { body, tag, icon: '/favicon.svg' })
    notification.onclick = () => {
      window.focus()
      notification.close()
      onClick()
    }
    return true
  } catch {
    return false
  }
}
