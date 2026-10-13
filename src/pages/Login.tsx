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
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const clean = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({ email: clean, password })
    setBusy(false)
    if (error) {
      setError(/invalid login/i.test(error.message) ? 'Wrong email or password.' : error.message)
      return
    }
    try {
      localStorage.setItem(EMAIL_KEY, clean)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="login">
      <h1>Workout Tracker</h1>
      <form onSubmit={signIn} className="stack">
        <label>
          Email
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
