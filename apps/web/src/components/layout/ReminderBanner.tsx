import { Alert, AlertDescription, AlertTitle } from '@routine-builder/ui/components/alert'
import { Button } from '@routine-builder/ui/components/button'
import { Link } from '@tanstack/react-router'
import { BellRing, X } from 'lucide-react'
import { useReminders } from '../../notifications/remindersContext'

// Reminders shown on the page when system notifications are off or unavailable.
export function ReminderBanner() {
  const { inApp, dismiss } = useReminders()

  return (
    <div aria-live="polite" className="space-y-2 empty:hidden [&:not(:empty)]:mb-6">
      {inApp.map((reminder) => (
        <Alert key={reminder.key} className="pr-12">
          <BellRing aria-hidden="true" />
          <AlertTitle>{reminder.title}</AlertTitle>
          <AlertDescription>
            <p>
              {reminder.body} ·{' '}
              <Link
                to="/"
                hash={reminder.targetId}
                className="underline underline-offset-4"
                onClick={() => dismiss(reminder.key)}
              >
                View in Today
              </Link>
            </p>
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-7"
            aria-label={`Dismiss reminder: ${reminder.title}`}
            onClick={() => dismiss(reminder.key)}
          >
            <X aria-hidden="true" />
          </Button>
        </Alert>
      ))}
    </div>
  )
}
