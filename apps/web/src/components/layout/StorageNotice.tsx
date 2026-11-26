import { Alert, AlertDescription, AlertTitle } from '@routine-builder/ui/components/alert'
import { Button } from '@routine-builder/ui/components/button'
import { AlertCircle, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../../state/appStateContext'

// Explains storage problems: unreadable saved data, blocked storage, or a failed save.
export function StorageNotice() {
  const { loadStatus, backupKey, saveError } = useAppState()
  const [dismissed, setDismissed] = useState(false)

  if (saveError) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Your last change could not be saved</AlertTitle>
        <AlertDescription>{saveError}</AlertDescription>
      </Alert>
    )
  }

  if (dismissed || (loadStatus !== 'recovered' && loadStatus !== 'unavailable')) return null

  return (
    <Alert role="status" className="mb-6 pr-12">
      <TriangleAlert aria-hidden="true" />
      {loadStatus === 'recovered' ? (
        <>
          <AlertTitle>Your saved routines could not be read</AlertTitle>
          <AlertDescription>
            <p>
              The app started fresh.
              {backupKey && (
                <>
                  {' '}
                  A copy of the old data was kept in this browser under{' '}
                  <code className="font-mono text-xs">{backupKey}</code>.
                </>
              )}
            </p>
          </AlertDescription>
        </>
      ) : (
        <>
          <AlertTitle>Storage is blocked</AlertTitle>
          <AlertDescription>
            This browser is blocking site storage, so your routines will not be saved.
          </AlertDescription>
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 size-7"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        <X aria-hidden="true" />
      </Button>
    </Alert>
  )
}
