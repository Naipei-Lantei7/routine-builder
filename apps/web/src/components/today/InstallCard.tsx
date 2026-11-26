import { Button } from '@routine-builder/ui/components/button'
import { Card, CardContent } from '@routine-builder/ui/components/card'
import { Share, Smartphone, SquarePlus, X } from 'lucide-react'
import { useState } from 'react'
import { isIos, isStandalone, useInstallPrompt } from '../../pwa/install'

const DISMISSED_KEY = 'routine-builder:install-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

// Suggests installing the app: a one-tap install where the browser supports it
// (Chrome, Edge, Samsung Internet), and the Add to Home Screen steps on iPhone,
// where installing is also what makes reminders possible.
export function InstallCard() {
  const { canInstall, install } = useInstallPrompt()
  const [standalone] = useState(isStandalone)
  const [ios] = useState(isIos)
  const [dismissed, setDismissed] = useState(readDismissed)

  if (standalone || dismissed || (!canInstall && !ios)) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Storage blocked: the card stays hidden for this visit only.
    }
  }

  return (
    <Card className="relative py-4">
      <CardContent className="flex items-start gap-3 px-4 pr-12">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Smartphone className="size-5" aria-hidden="true" />
        </div>
        {canInstall ? (
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Install Routine Builder</p>
              <p className="text-sm text-muted-foreground">
                Open it from your home screen like any other app.
              </p>
            </div>
            <Button size="sm" onClick={() => void install()}>
              Install
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium">Add Routine Builder to your Home Screen</p>
            <p className="text-sm text-muted-foreground">
              In Safari, tap{' '}
              <Share className="inline size-4 align-text-bottom" aria-label="Share" /> then{' '}
              <span className="whitespace-nowrap">
                <SquarePlus className="inline size-4 align-text-bottom" aria-hidden="true" /> Add to
                Home Screen
              </span>
              . On iPhone, reminders only work from the installed app.
            </p>
          </div>
        )}
      </CardContent>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 size-7"
        aria-label="Dismiss install suggestion"
        onClick={dismiss}
      >
        <X aria-hidden="true" />
      </Button>
    </Card>
  )
}
