import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Account created. If email confirmation is on, check your inbox first.')
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl font-medium">Design<span className="text-accent">OS</span></h1>
        <p className="mt-2 text-sm text-ink-soft">The operating system for your design process.</p>
        <form onSubmit={submit} className="mt-8 space-y-3">
          <div>
            <label className="label-mono">Email</label>
            <input className="field mt-1" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label-mono">Password</label>
            <input className="field mt-1" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
          <button className="btn-primary w-full justify-center" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        {msg && <p className="mt-3 text-sm text-accent">{msg}</p>}
        <button
          className="mt-6 font-mono text-[11px] uppercase tracking-wide text-ink-faint hover:text-ink"
          onClick={() => setMode(m => (m === 'signin' ? 'signup' : 'signin'))}
        >
          {mode === 'signin' ? 'First time? Create the account' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
