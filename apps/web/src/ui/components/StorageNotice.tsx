import { useState } from 'react'
import { useAppState } from '../../state/appStateContext'

/** Explains storage problems: unreadable saved data, blocked storage, or a failed save. */
export function StorageNotice() {
  const { loadStatus, backupKey, saveError } = useAppState()
  const [dismissed, setDismissed] = useState(false)

  if (saveError) {
    return (
      <div className="notice notice-error" role="alert">
        Your last change could not be saved: {saveError}
      </div>
    )
  }

  if (dismissed) return null

  if (loadStatus === 'recovered') {
    return (
      <div className="notice notice-warning" role="status">
        <p>
          Your saved routines could not be read, so the app started fresh.
          {backupKey && (
            <>
              {' '}
              A copy of the old data was kept in this browser under <code>{backupKey}</code>.
            </>
          )}
        </p>
        <button type="button" className="button-link" onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </div>
    )
  }

  if (loadStatus === 'unavailable') {
    return (
      <div className="notice notice-warning" role="status">
        <p>This browser is blocking site storage, so your routines will not be saved.</p>
        <button type="button" className="button-link" onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </div>
    )
  }

  return null
}
