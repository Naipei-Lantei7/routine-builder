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
  // In-app path to open when the notification is clicked, e.g. "/#today-…".
  url: string
  // Used only for page notifications; service worker clicks are handled in sw.ts.
  onClick: () => void
}

// Shows an OS notification. Prefers the service worker, which Android requires
// and which can handle clicks after the page is gone; falls back to a page
// notification. Returns false when neither works, so the caller can show the
// reminder in the app instead.
export async function showSystemNotification(notification: SystemNotification): Promise<boolean> {
  if (getPermission() !== 'granted') return false
  return (await showViaServiceWorker(notification)) || showViaPage(notification)
}

async function showViaServiceWorker({ title, body, tag, url }: SystemNotification) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (!registration?.active) return false
    await registration.showNotification(title, {
      body,
      tag,
      icon: '/icons/icon-192.png',
      data: { url },
    })
    return true
  } catch {
    return false
  }
}

function showViaPage({ title, body, tag, onClick }: SystemNotification) {
  try {
    const notification = new Notification(title, { body, tag, icon: '/icons/icon-192.png' })
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
