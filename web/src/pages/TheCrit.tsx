import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { critSend, critCapture } from '../lib/api'
import { useBrands, useItems } from '../hooks/useData'
import ItemImage from '../components/ItemImage'

interface CritSession {
  id: string
  title: string
  image_path: string
  brand_id: string | null
  intent: string | null
  status: string
  created_at: string
}

interface CritMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function useSessions() {
  return useQuery({
    queryKey: ['crit_sessions'],
    queryFn: async (): Promise<CritSession[]> => {
      const { data, error } = await supabase.from('crit_sessions').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

function useMessages(sessionId: string | null) {
  return useQuery({
    queryKey: ['crit_messages', sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<CritMessage[]> => {
      const { data, error } = await supabase.from('crit_messages').select('id,role,content').eq('session_id', sessionId!).order('created_at')
      if (error) throw error
      return data
    },
  })
}

export default function TheCrit() {
  const sessions = useSessions().data ?? []
  const brands = useBrands().data ?? []
  const items = useItems('approved').data ?? []
  const qc = useQueryClient()

  const [activeId, setActiveId] = useState<string | null>(null)
  const active = sessions.find(s => s.id === activeId) ?? null
  const messages = useMessages(activeId).data ?? []

  // new crit form
  const [showNew, setShowNew] = useState(false)
  const [source, setSource] = useState<'upload' | 'item'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [itemId, setItemId] = useState('')
  const [title, setTitle] = useState('')
  const [brandId, setBrandId] = useState('')
  const [intent, setIntent] = useState('')

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [captured, setCaptured] = useState<string[] | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length, busy])

  async function startCrit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      let imagePath: string
      let resolvedTitle = title.trim()
      if (source === 'item') {
        const item = items.find(i => i.id === itemId)
        if (!item?.image_path) throw new Error('Pick a library item')
        imagePath = item.image_path
        if (!resolvedTitle) resolvedTitle = item.title
      } else {
        if (!file) throw new Error('Choose an image of the work to crit')
        const ext = (file.name.split('.').pop() || 'png').toLowerCase()
        imagePath = `crits/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from('inspiration').upload(imagePath, file, { contentType: file.type || 'image/png' })
        if (error) throw error
        if (!resolvedTitle) resolvedTitle = file.name.replace(/\.[^.]+$/, '')
      }
      const firstMessage = intent.trim()
        ? `Here's the work. Intent: ${intent.trim()} — read it and let's begin.`
        : `Here's the work — read it and ask me what you need to know before we begin.`
      const { session_id } = await critSend({
        new_session: { title: resolvedTitle, image_path: imagePath, item_id: source === 'item' ? itemId : null, brand_id: brandId || null, intent: intent.trim() || null },
        message: firstMessage,
      })
      await qc.invalidateQueries({ queryKey: ['crit_sessions'] })
      await qc.invalidateQueries({ queryKey: ['crit_messages'] })
      setActiveId(session_id)
      setShowNew(false)
      setFile(null); setItemId(''); setTitle(''); setIntent('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the crit')
    } finally {
      setBusy(false)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !activeId) return
    setErr('')
    setBusy(true)
    const text = input
    setInput('')
    try {
      await critSend({ session_id: activeId, message: text })
      qc.invalidateQueries({ queryKey: ['crit_messages', activeId] })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Send failed')
      setInput(text)
    } finally {
      setBusy(false)
    }
  }

  async function capture() {
    if (!activeId) return
    setErr('')
    setBusy(true)
    try {
      const { rulings } = await critCapture(activeId)
      setCaptured(rulings)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Capture failed')
    } finally {
      setBusy(false)
    }
  }

  // ---------- session view ----------
  if (active) {
    return (
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="min-w-0">
            <button className="font-mono text-[11px] uppercase tracking-wide text-ink-faint hover:text-ink" onClick={() => { setActiveId(null); setCaptured(null) }}>← all crits</button>
            <h1 className="truncate font-display text-2xl font-medium">{active.title}</h1>
          </div>
          <button className="btn-secondary shrink-0" onClick={capture} disabled={busy || messages.length < 2}>
            Capture rulings
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto py-5">
          <ItemImage path={active.image_path} alt={active.title} className="max-h-64 w-full rounded-lg border border-line" />
          {messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-ink text-paper' : 'border border-line bg-white shadow-card'
              }`}>{m.content}</div>
            </div>
          ))}
          {busy && <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">critic is looking…</p>}
          {captured && (
            <div className="rounded-xl border border-accent/40 bg-accent-soft/30 p-4 text-sm">
              <p className="label-mono text-accent">Rulings captured to a profile draft</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {captured.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              <Link to="/profile" className="mt-3 inline-block font-medium text-accent hover:underline">Review and approve on the Style profile page →</Link>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {err && <p className="pb-2 text-sm text-accent">{err}</p>}
        <form onSubmit={send} className="flex gap-2 border-t border-line pt-3 pb-2">
          <input className="field" placeholder="Respond, push back, or ask…" value={input} onChange={e => setInput(e.target.value)} disabled={busy} />
          <button className="btn-primary shrink-0" disabled={busy || !input.trim()}>Send</button>
        </form>
      </div>
    )
  }

  // ---------- list / new ----------
  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">The Crit</h1>
          <p className="mt-1 text-sm text-ink-soft">Pin the work up. We look at it together — intent first, principles named, evidence on the canvas. Agreed rulings get captured to your style profile, and every future export inherits them.</p>
        </div>
        <button className="btn-secondary shrink-0" onClick={() => setShowNew(v => !v)}>+ New crit</button>
      </div>

      {showNew && (
        <form onSubmit={startCrit} className="mt-5 rounded-xl border border-line bg-white p-5 shadow-card">
          <div className="flex gap-2">
            <button type="button" className={`chip ${source === 'upload' ? 'chip-active' : ''}`} onClick={() => setSource('upload')}>Upload work</button>
            <button type="button" className={`chip ${source === 'item' ? 'chip-active' : ''}`} onClick={() => setSource('item')}>From library</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {source === 'upload' ? (
              <div>
                <label className="label-mono">Design to critique (screenshot/image)</label>
                <input className="field mt-1" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>
            ) : (
              <div>
                <label className="label-mono">Library item</label>
                <select className="field mt-1" value={itemId} onChange={e => setItemId(e.target.value)}>
                  <option value="">—</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label-mono">Brand context (optional)</label>
              <select className="field mt-1" value={brandId} onChange={e => setBrandId(e.target.value)}>
                <option value="">—</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="label-mono">Title</label>
            <input className="field mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="RhinoGuard landing v2" />
          </div>
          <div className="mt-3">
            <label className="label-mono">Intent — what is this design for?</label>
            <textarea className="field mt-1" rows={2} value={intent} onChange={e => setIntent(e.target.value)} placeholder="Audience, the one message, the action you want taken. The crit anchors on this." />
          </div>
          {err && <p className="mt-2 text-sm text-accent">{err}</p>}
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? 'Opening the crit…' : 'Start crit'}</button>
            <button type="button" className="btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        </form>
      )}

      {sessions.length === 0 && !showNew ? (
        <div className="mt-16 text-center">
          <p className="font-display text-xl text-ink-soft">No crits yet.</p>
          <p className="mt-2 text-sm text-ink-faint">Pin up a work-in-progress and let's look at it together.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {sessions.map(s => (
            <button key={s.id} className="flex w-full items-center gap-4 rounded-xl border border-line bg-white p-3 text-left shadow-card transition-shadow hover:shadow-panel" onClick={() => setActiveId(s.id)}>
              <ItemImage path={s.image_path} alt={s.title} className="h-16 w-24 shrink-0 rounded-md border border-line" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-medium">{s.title}</p>
                <p className="font-mono text-[11px] text-ink-faint">{new Date(s.created_at).toLocaleDateString()}{s.intent ? ` · ${s.intent.slice(0, 60)}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
