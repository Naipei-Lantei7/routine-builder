import { Button } from '@routine-builder/ui/components/button'
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { ListChecks } from 'lucide-react'
import { StorageNotice } from '../components/layout/StorageNotice'
import { ThemeToggle } from '../components/layout/ThemeToggle'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <ListChecks className="size-5" aria-hidden="true" />
            <h1 className="text-base">Routine Builder</h1>
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <StorageNotice />
        <Outlet />
      </main>
    </div>
  )
}

function NotFound() {
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <Button asChild variant="outline">
        <Link to="/">Back to routines</Link>
      </Button>
    </div>
  )
}
