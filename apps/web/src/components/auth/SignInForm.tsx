import { Button } from '@routine-builder/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@routine-builder/ui/components/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@routine-builder/ui/components/field'
import { Input } from '@routine-builder/ui/components/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@routine-builder/ui/components/input-otp'
import { Loader2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/authContext'

const RESEND_SECONDS = 30

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.'
}

// Two steps: enter an email, then type the 6-digit code from it. A code typed into
// the app works in an installed iPhone app, where a link in an email would not.
export function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const { requestCode, verifyCode } = useAuth()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  async function sendCode() {
    setBusy(true)
    setError(null)
    try {
      await requestCode(email)
      setStep('code')
      setCode('')
      setResendIn(RESEND_SECONDS)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(value: string) {
    setBusy(true)
    setError(null)
    try {
      await verifyCode(email, value)
      onSignedIn()
    } catch (err) {
      setError(messageOf(err))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  function onEmailSubmit(event: FormEvent) {
    event.preventDefault()
    void sendCode()
  }

  function onCodeSubmit(event: FormEvent) {
    event.preventDefault()
    if (code.length === 6) void submitCode(code)
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h2 className="text-xl">Sign in</h2>
        </CardTitle>
        <CardDescription>
          {step === 'email'
            ? 'We’ll email you a 6-digit code. No password needed.'
            : `We sent a code to ${email}. It expires in 10 minutes.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'email' ? (
          <form onSubmit={onEmailSubmit} noValidate className="space-y-4">
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
              <Input
                id="sign-in-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'sign-in-error' : undefined}
              />
              {error && <FieldError id="sign-in-error">{error}</FieldError>}
            </Field>
            <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={onCodeSubmit} noValidate className="space-y-4">
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="sign-in-code">Code</FieldLabel>
              <InputOTP
                id="sign-in-code"
                maxLength={6}
                pattern="^\d+$"
                autoComplete="one-time-code"
                inputMode="numeric"
                value={code}
                disabled={busy}
                autoFocus
                onChange={setCode}
                // Submit as soon as the sixth digit is typed or pasted.
                onComplete={(value: string) => void submitCode(value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'sign-in-error' : 'sign-in-code-hint'}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} className="size-11 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {error ? (
                <FieldError id="sign-in-error">{error}</FieldError>
              ) : (
                <FieldDescription id="sign-in-code-hint">
                  Check your inbox, and your spam folder just in case.
                </FieldDescription>
              )}
            </Field>
            <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              Sign in
            </Button>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <Button
                type="button"
                variant="link"
                className="h-auto px-0"
                onClick={() => {
                  setStep('email')
                  setError(null)
                }}
              >
                Use a different email
              </Button>
              <Button
                type="button"
                variant="link"
                className="h-auto px-0"
                disabled={busy || resendIn > 0}
                onClick={() => void sendCode()}
              >
                {resendIn > 0 ? `Send a new code (${resendIn}s)` : 'Send a new code'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
