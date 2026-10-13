import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

const EMAIL_KEY = 'wt-email'

export default function Login() {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const clean = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: false },
    })
    setBusy(false)
    if (error) {
      setError(
        /signups? not allowed|not found/i.test(error.message)
          ? 'That email has not been invited to this app.'
          : error.message,
      )
      return
    }
    try {
      localStorage.setItem(EMAIL_KEY, clean)
    } catch {
      /* ignore */
    }
    setSent(true)
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="login">
      <h1>Workout Tracker</h1>
      {!sent ? (
        <form onSubmit={sendCode} className="stack">
          <label>
            Email
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button className="primary" disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <p className="muted">Enter the code sent to {email}.</p>
          <label>
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          <button className="primary" disabled={busy || code.trim().length < 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="link" onClick={() => { setSent(false); setCode('') }}>
            Use a different email
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
