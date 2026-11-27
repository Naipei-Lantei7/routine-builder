import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SignInForm } from '../components/auth/SignInForm'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <SignInForm onSignedIn={() => navigate({ to: '/' })} />
      <p className="mx-auto max-w-sm text-center text-sm text-muted-foreground">
        Signing in keeps your routines in sync across your devices. Routines already on this device
        are added to your account.
      </p>
    </div>
  )
}
