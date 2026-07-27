import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, signedUrl } from '../lib/supabase'
import { critSend, critCapture, type CritRuling } from '../lib/api'
import { useBrands, useItems } from '../hooks/useData'
import ItemImage from '../components/ItemImage'
import Md from '../components/Md'

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

const PRINCIPLES: [string, string][] = [
  ['Alignment', 'Shared edges and baselines create invisible structure. Almost-aligned is worse than unaligned.'],
  ['Contrast', 'Difference directs the eye. If everything is emphasized, nothing is.'],
  ['Balance', 'Visual weight distributed — symmetric (calm) or asymmetric (dynamic), chosen deliberately.'],
  ['Hierarchy', 'The read order 1-2-3, decided before styling. One obvious entry point.'],
  ['Color', 'Strict palette, one accent with a usage rule. 60-30-10 proportion.'],
  ['White space', 'Emptiness is a design element. Tight within groups, generous between.'],
  ['Proportion', 'Relative size signals importance. 2× is a decision; 1.15× is a mistake.'],
  ['Repetition', 'Reused styles create cohesion and brand memory.'],
  ['Rhythm', 'The spacing pattern of repeats: regular, flowing, progressive.'],
  ['Movement', 'The path the eye travels — Z-pattern, F-pattern. The CTA sits where the path ends.'],
  ['Emphasis', 'One focal point per composition, served by everything else.'],
  ['Proximity', 'Closeness signals relationship. Group the related; separate the rest.'],
  ['Unity', 'Everything feels like one system. No element from a different design.'],
  ['Variety', "Controlled difference keeps unity from going boring — within the system, never imported."],
]

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

const OPENING = '*pins the work up*'

export default function TheCrit() {
  const sessions = useSessions().data ?? []
  const brands = useBrands().data ?? []
  const items = useItems('approved').data ?? []
  const qc = useQueryClient()

  const [activeId, setActiveId] = useState<string | null>(null)
  const active = sessions.find(s => s.id === activeId) ?? null
  const messages = useMessages(activeId).data ?? []

  const [brandId, setBrandId] = useState('')
  const [starting, setStarting] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [captured, setCaptured] = useState<CritRuling[] | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [topic, setTopic] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length, busy])
  useEffect(() => {
    let live = true
    if (active?.image_path) signedUrl(active.image_path).then(u => live && setImgUrl(u))
    else setImgUrl(null)
    return () => { live = false }
  }, [active?.image_path])

  async function pinUp(imagePath: string, title: string, itemId?: string) {
    setErr('')
    setStarting(true)
    try {
      const { session_id } = await critSend({
        new_session: { title, image_path: imagePath, item_id: itemId ?? null, brand_id: brandId || null, intent: null },
        message: OPENING,
      })
      await qc.invalidateQueries({ queryKey: ['crit_sessions'] })
      await qc.invalidateQueries({ queryKey: ['crit_messages'] })
      setActiveId(session_id)
      setCaptured(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the crit')
    } finally {
      setStarting(false)
    }
  }

  async function onFile(file: File | null) {
    if (!file) return
    setErr('')
    setStarting(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `crits/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('inspiration').upload(path, file, { contentType: file.type || 'image/png' })
      if (error) throw error
      await pinUp(path, file.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
      setStarting(false)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !activeId) return
    setErr('')
    setBusy(true)
    const text = topic ? `## ${topic}\n${input}` : input
    setInput('')
    setTopic(null)
    try {
      await critSend({ session_id: activeId, message: text })
      qc.invalidateQueries({ queryKey: ['crit_messages', activeId] })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Send failed')
      setInput(input)
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

  // ================= session: split-screen studio =================
  if (active) {
    return (
      <div className="flex h-[calc(100vh-4rem)] gap-6">
        {/* the wall — work pinned up */}
        <div className="flex w-1/2 flex-col">
          <div className="flex items-center justify-between pb-2">
            <button className="font-mono text-[11px] uppercase tracking-wide text-ink-faint hover:text-ink" onClick={() => { setActiveId(null); setCaptured(null) }}>← all crits</button>
            <span className="truncate pl-3 font-display text-lg font-medium">{active.title}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-white p-2 shadow-card">
            {imgUrl
              ? <img src={imgUrl} alt={active.title} className="w-full" />
              : <div className="h-full animate-pulse bg-paper-deep" />}
          </div>
        </div>

        {/* the conversation */}
        <div className="flex w-1/2 flex-col">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="label-mono">In crit with your design director</span>
            <button className="btn-secondary" onClick={capture} disabled={busy || messages.length < 3}>
              Capture rulings
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
            {messages.filter(m => m.content !== OPENING).map(m => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[90%] rounded-xl px-4 py-3 ${
                  m.role === 'user' ? 'on-ink bg-ink text-paper' : 'border border-line bg-white shadow-card'
                }`}>
                  <Md>{m.content}</Md>
                </div>
              </div>
            ))}
            {(busy || starting) && <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">looking at the work…</p>}
            {captured && (
              <div className="rounded-xl border border-accent/40 bg-accent-soft/30 p-4 text-sm">
                <p className="label-mono text-accent">Rulings captured to a profile draft</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {captured.map((r, i) => <li key={i}><strong>{r.principle}:</strong> {r.ruling}</li>)}
                </ul>
                <Link to="/profile" className="mt-3 inline-block font-medium text-accent hover:underline">Review and approve on the Style profile page →</Link>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {err && <p className="pb-2 text-sm text-accent">{err}</p>}
          <div className="border-t border-line pt-2">
            <div className="flex flex-wrap gap-1.5 pb-2">
              {PRINCIPLES.map(([name, line]) => (
                <button
                  key={name}
                  type="button"
                  title={line}
                  className={`chip !px-2.5 !py-0.5 ${topic === name ? 'chip-active' : ''}`}
                  onClick={() => setTopic(t => (t === name ? null : name))}
                >
                  {name}
                </button>
              ))}
            </div>
            <form onSubmit={send} className="flex gap-2">
              <input
                className="field"
                placeholder={topic ? `Your read on ${topic}…` : 'Talk to the room, or pick a principle above…'}
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <button className="btn-primary shrink-0" disabled={busy || !input.trim()}>Send</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ================= start: pin something up =================
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-medium">The Crit</h1>
      <p className="mt-1 text-sm text-ink-soft">Pin the work up and the conversation starts — your design director reads it, asks what it's for, and you take it from there. Agreed rulings get captured to your style profile.</p>

      <div
        className="mt-6 cursor-pointer rounded-xl border-2 border-dashed border-line bg-white/50 p-10 text-center transition-colors hover:border-accent"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files?.[0] ?? null) }}
      >
        <p className="font-display text-xl">{starting ? 'Pinning it up…' : 'Drop a design here'}</p>
        <p className="mt-1 text-sm text-ink-faint">or click to choose — a screenshot, a draft, a variant you're unsure about</p>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => onFile(e.target.files?.[0] ?? null)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="label-mono">Brand context</label>
        <select className="field max-w-56" value={brandId} onChange={e => setBrandId(e.target.value)}>
          <option value="">none / personal</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span className="text-sm text-ink-faint">·</span>
        <label className="label-mono">or crit a library item</label>
        <select
          className="field max-w-64"
          value=""
          onChange={e => {
            const item = items.find(i => i.id === e.target.value)
            if (item?.image_path) pinUp(item.image_path, item.title, item.id)
          }}
        >
          <option value="">choose…</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
      </div>
      {err && <p className="mt-3 text-sm text-accent">{err}</p>}

      {sessions.length > 0 && (
        <div className="mt-10">
          <p className="label-mono">Past crits</p>
          <div className="mt-2 space-y-2">
            {sessions.map(s => (
              <button key={s.id} className="flex w-full items-center gap-4 rounded-xl border border-line bg-white p-3 text-left shadow-card transition-shadow hover:shadow-panel" onClick={() => { setActiveId(s.id); setCaptured(null) }}>
                <ItemImage path={s.image_path} alt={s.title} className="h-14 w-20 shrink-0 rounded-md border border-line" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-medium">{s.title}</p>
                  <p className="font-mono text-[11px] text-ink-faint">{new Date(s.created_at).toLocaleDateString()}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
