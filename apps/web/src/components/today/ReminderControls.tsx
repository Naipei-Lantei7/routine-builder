import { Button } from '@routine-builder/ui/components/button'
import { BellOff, BellRing } from 'lucide-react'
import type { ReactNode } from 'react'
import { useReminders } from '../../notifications/remindersContext'

// Explains the reminder state and asks for notification permission, but only
// when the user clicks: never on page load.
export function ReminderControls() {
  const { permission, enable } = useReminders()

  if (permission === 'granted') {
    return (
      <Note icon={<BellRing className="size-4" aria-hidden="true" />}>
        Reminders are on. They work while this tab is open.
      </Note>
    )
  }

  if (permission === 'default') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="outline" size="sm" onClick={() => void enable()}>
          <BellRing aria-hidden="true" />
          Turn on reminders
        </Button>
        <span className="text-sm text-muted-foreground">
          Reminders work while this tab is open.
        </span>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <Note icon={<BellOff className="size-4" aria-hidden="true" />}>
        Notifications are blocked for this site. To get them, allow notifications in your browser’s
        site settings. Until then, reminders appear on this page while it is open.
      </Note>
    )
  }

  return (
    <Note icon={<BellOff className="size-4" aria-hidden="true" />}>
      This browser can’t show notifications. Reminders appear on this page while it is open.
    </Note>
  )
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  )
}
