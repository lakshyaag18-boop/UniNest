import { useState } from 'react'
import { Loader2, LockKeyhole, Mail, User } from 'lucide-react'
import { Logo } from './Brand'
import { COLLEGE_EMAIL_DOMAIN, collegeEmailError, isCollegeEmail } from '../lib/college'
import { signInStudent, signUpStudent } from '../lib/store'

export default function AuthGate({ demo = false, onDemoLogin }) {
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ email: '', password: '', displayName: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isSignUp = !demo && mode === 'signup'

  function switchMode(next) {
    setMode(next)
    setError('')
    setNotice('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (!isCollegeEmail(form.email)) throw new Error(collegeEmailError())

      if (demo) {
        if (!form.displayName.trim()) throw new Error('Enter the name your group will see.')
        await onDemoLogin({ displayName: form.displayName, email: form.email })
      } else if (isSignUp) {
        if (!form.displayName.trim()) throw new Error('Add the name your group will see.')
        if (form.password.length < 6) throw new Error('Use at least 6 characters for your password.')
        const data = await signUpStudent(form)
        if (!data.session) {
          setNotice('Almost there — confirm your email address, then sign in.')
        }
      } else {
        await signInStudent(form)
      }
    } catch (err) {
      const message = err.message || 'Something went wrong. Try again.'
      setError(
        /email not confirmed/i.test(message)
          ? 'Confirm your email address first, then sign in.'
          : message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream">
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <Logo className="size-16" />
            <h1 className="mt-5 text-3xl font-semibold tracking-tight">UniNest</h1>
            <p className="mt-1.5 text-sm text-ink-soft">Chat together. Keep what matters.</p>
          </div>

          {!demo && (
            <div className="mt-7 flex rounded-2xl border border-line bg-white p-1">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  !isSignUp ? 'bg-sage-soft text-sage-dark' : 'text-ink-soft'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isSignUp ? 'bg-sage-soft text-sage-dark' : 'text-ink-soft'
                }`}
              >
                Create account
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-3 space-y-3 rounded-3xl border border-line bg-white p-5 shadow-sm"
          >
            {demo && (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Sign in</h2>
                  <p className="mt-0.5 text-[11px] text-ink-soft">No password needed in demo mode.</p>
                </div>
                <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] font-semibold text-sage-dark">
                  Demo
                </span>
              </div>
            )}

            {(isSignUp || demo) && (
              <Field icon={User} label="Display name" htmlFor="auth-name">
                <input
                  id="auth-name"
                  value={form.displayName}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  maxLength={32}
                  required
                  placeholder="e.g. Aditi"
                  autoComplete="nickname"
                  className={inputClass}
                />
              </Field>
            )}

            <Field icon={Mail} label="College email" htmlFor="auth-email">
              <input
                id="auth-email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder={`you@${COLLEGE_EMAIL_DOMAIN}`}
                autoComplete="email"
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-ink-soft">
                Only @{COLLEGE_EMAIL_DOMAIN} college emails can sign in.
              </p>
            </Field>

            {!demo && (
              <Field icon={LockKeyhole} label="Password" htmlFor="auth-password">
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className={inputClass}
                />
              </Field>
            )}

            {error && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-2xl border border-sage/40 bg-sage-soft px-3 py-2 text-xs text-sage-dark">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-sage px-4 py-3 text-sm font-semibold text-white transition hover:bg-sage-dark disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {demo ? 'Enter UniNest' : isSignUp ? 'Create account' : 'Sign in'}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-ink-soft">
              {demo
                ? 'Demo mode: this account and its groups are stored in this browser only.'
                : isSignUp
                  ? `Use your @${COLLEGE_EMAIL_DOMAIN} email. If confirmation is on, confirm the link before signing in.`
                  : 'Welcome back. Your groups and Nest Egg are waiting.'}
            </p>
          </form>

        </div>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-2xl border border-line bg-cream px-3.5 py-2.5 text-base outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20'

function Field({ icon: Icon, label, htmlFor, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft"
      >
        <Icon className="size-3.5 text-sage-dark" />
        {label}
      </label>
      {children}
    </div>
  )
}
