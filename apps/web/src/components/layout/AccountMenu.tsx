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
import { LogOut } from 'lucide-react'
import { useAuth } from '../../auth/authContext'

// "Sign in" when signed out; the account's initial with a menu when signed in.
export function AccountMenu() {
  const { status, user, signOut } = useAuth()
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
        <DropdownMenuItem
          onSelect={() => {
            void signOut().then(() => navigate({ to: '/' }))
          }}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
