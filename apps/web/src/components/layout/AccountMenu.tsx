import { Button } from '@routine-builder/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@routine-builder/ui/components/dropdown-menu'
import { Link, useNavigate } from '@tanstack/react-router'
import { Cloud, CloudOff, LogOut, RefreshCw, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../auth/authContext'
import { useSync, type SyncStatus } from '../../sync/syncContext'

// "Sign in" when signed out; the account's initial with a menu when signed in.
export function AccountMenu() {
  const { status, user } = useAuth()
  const sync = useSync()
  const navigate = useNavigate()

  if (status === 'loading') return null

  if (!user) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link to="/sign-in">Sign in</Link>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={`Account: ${user.email}`}
        >
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground uppercase"
          >
            {user.email[0]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate text-sm font-medium">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <SyncStatusItem status={sync.status} pending={sync.pending} onRetry={sync.syncNow} />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void sync.signOut().then(() => navigate({ to: '/' }))
          }}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const STATUS: Record<SyncStatus, { icon: typeof Cloud; text: string }> = {
  local: { icon: CloudOff, text: 'Saved on this device' },
  syncing: { icon: RefreshCw, text: 'Syncing…' },
  synced: { icon: Cloud, text: 'Synced' },
  offline: { icon: CloudOff, text: 'Offline. Changes will sync later' },
  error: { icon: TriangleAlert, text: 'Sync failed' },
}

function SyncStatusItem({
  status,
  pending,
  onRetry,
}: {
  status: SyncStatus
  pending: number
  onRetry: () => Promise<void>
}) {
  const { icon: Icon, text } = STATUS[status]
  const canRetry = status === 'offline' || status === 'error'
  return (
    <DropdownMenuItem
      disabled={!canRetry}
      onSelect={(event) => {
        // Keep the menu open to show the result.
        event.preventDefault()
        void onRetry()
      }}
    >
      <Icon className={status === 'syncing' ? 'animate-spin' : undefined} aria-hidden="true" />
      <span className="flex-1">{text}</span>
      {pending > 0 && status !== 'synced' && (
        <span className="text-xs text-muted-foreground">{pending} waiting</span>
      )}
      {canRetry && <span className="text-xs text-muted-foreground">Retry</span>}
    </DropdownMenuItem>
  )
}
