import { Button } from '@routine-builder/ui/components/button'
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { ListChecks } from 'lucide-react'
import type { ReactNode } from 'react'
import { ReminderBanner } from '../components/layout/ReminderBanner'
import { StorageNotice } from '../components/layout/StorageNotice'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { RemindersProvider } from '../notifications/RemindersProvider'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <RemindersProvider>
      <div className="min-h-svh">
        <header className="border-b">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 font-semibold">
                <ListChecks className="size-5" aria-hidden="true" />
                <h1 className="sr-only text-base sm:not-sr-only">Routine Builder</h1>
              </Link>
              <nav aria-label="Main" className="flex items-center gap-1">
                <NavLink to="/" exact>
                  Today
                </NavLink>
                <NavLink to="/routines">Routines</NavLink>
              </nav>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-8">
          <StorageNotice />
          <ReminderBanner />
          <Outlet />
        </main>
      </div>
    </RemindersProvider>
  )
}

function NavLink({
  to,
  exact = false,
  children,
}: {
  to: '/' | '/routines'
  exact?: boolean
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
    >
      {children}
    </Link>
  )
}

function NotFound() {
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <Button asChild variant="outline">
        <Link to="/">Go to today</Link>
      </Button>
    </div>
  )
}
