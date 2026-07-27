import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useItems } from '../hooks/useData'
import IngestDialog from './IngestDialog'

export default function Shell({ children }: { children: React.ReactNode }) {
  const [ingestOpen, setIngestOpen] = useState(false)
  const pending = useItems('pending_review').data?.length ?? 0

  const link = ({ isActive }: { isActive: boolean }) =>
    `relative block rounded-md px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-paper-deep font-semibold text-ink before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-accent'
        : 'text-ink-soft hover:bg-paper-deep/60'
    }`

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-line bg-paper px-4 py-6">
        <div className="px-3">
          <span className="font-display text-2xl font-medium">design library</span>
        </div>
        <nav className="mt-8 flex-1 space-y-1">
          <NavLink to="/" end className={link}>Library</NavLink>
          <NavLink to="/review" className={link}>
            Review queue
            {pending > 0 && (
              <span className="ml-2 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] text-paper">{pending}</span>
            )}
          </NavLink>
          <NavLink to="/brands" className={link}>Brands</NavLink>
          <NavLink to="/profile" className={link}>Style profile</NavLink>
          <NavLink to="/guide" className={link}>How to use</NavLink>
        </nav>
        <button className="btn-accent w-full justify-center" onClick={() => setIngestOpen(true)}>
          + Add inspiration
        </button>
        <button
          className="mt-4 px-3 text-left font-mono text-[11px] uppercase tracking-wide text-ink-faint hover:text-ink"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </aside>
      <main className="ml-56 flex-1 px-8 py-8">{children}</main>
      {ingestOpen && <IngestDialog onClose={() => setIngestOpen(false)} />}
    </div>
  )
}
