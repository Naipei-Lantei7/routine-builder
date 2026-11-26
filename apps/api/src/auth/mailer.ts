import type { Env } from '../env'

export interface Mailer {
  sendLoginCode(email: string, code: string): Promise<void>
}

const DEFAULT_FROM = 'Routine Builder <onboarding@resend.dev>'

export class EmailNotConfiguredError extends Error {
  override name = 'EmailNotConfiguredError'
}

// Sends through Resend. Local development opts in to logging codes instead, so a
// missing key in production fails loudly rather than putting codes in the logs.
export function mailerFromEnv(env: Env): Mailer {
  if (env.DEV_LOG_CODES === 'true') return consoleMailer
  if (!env.RESEND_API_KEY) {
    throw new EmailNotConfiguredError('RESEND_API_KEY is not set, so sign-in codes cannot be sent.')
  }
  return resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM ?? DEFAULT_FROM)
}

export const consoleMailer: Mailer = {
  async sendLoginCode(email, code) {
    console.log(`[dev] Sign-in code for ${email}: ${code}`)
  },
}

export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async sendLoginCode(email, code) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [email],
          subject: `${code} is your Routine Builder code`,
          text: [
            `Your sign-in code is ${code}.`,
            '',
            'Type it into Routine Builder to sign in. It expires in 10 minutes.',
            "If you didn't ask for this, you can ignore this email.",
          ].join('\n'),
        }),
      })
      if (!response.ok) {
        throw new Error(`Resend returned ${response.status}: ${await response.text()}`)
      }
    },
  }
}
