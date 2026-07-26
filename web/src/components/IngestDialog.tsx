import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { captureUrl, analyzeItem } from '../lib/api'
import { useBrands, useDesignTypes, useInsertItem } from '../hooks/useData'

type Step = 'form' | 'capturing' | 'analyzing' | 'done' | 'error'

export default function IngestDialog({ onClose }: { onClose: () => void }) {
  const brands = useBrands().data ?? []
  const types = useDesignTypes().data ?? []
  const insert = useInsertItem()
  const qc = useQueryClient()

  const [tab, setTab] = useState<'url' | 'image'>('url')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [typeId, setTypeId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [note, setNote] = useState('')
  const [autoAnalyze, setAutoAnalyze] = useState(true)
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      let imagePath: string | null = null
      let resolvedTitle = title.trim()
      let sourceUrl: string | null = null

      if (tab === 'url') {
        if (!/^https?:\/\//i.test(url)) throw new Error('Enter a full URL, starting with https://')
        setStep('capturing')
        const cap = await captureUrl(url)
        imagePath = cap.image_path
        sourceUrl = cap.source_url
        if (!resolvedTitle) resolvedTitle = cap.title
      } else {
        if (!file) throw new Error('Choose an image file')
        setStep('capturing')
        const ext = (file.name.split('.').pop() || 'png').toLowerCase()
        const path = `uploads/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('inspiration').upload(path, file, { contentType: file.type || 'image/png' })
        if (upErr) throw upErr
        imagePath = path
      }

      const item = await insert.mutateAsync({
        title: resolvedTitle || 'Untitled',
        source_url: sourceUrl || (tab === 'url' ? url : null),
        image_path: imagePath,
        design_type_id: typeId || null,
        brand_id: brandId || null,
        bob_note: note.trim() || null,
        status: 'pending_review',
      })

      if (autoAnalyze) {
        setStep('analyzing')
        await analyzeItem(item.id)
        qc.invalidateQueries({ queryKey: ['items'] })
        qc.invalidateQueries({ queryKey: ['families'] })
      }
      setStep('done')
      setTimeout(onClose, 900)
    } catch (err) {
      setStep('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const busy = step === 'capturing' || step === 'analyzing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-lg rounded-xl bg-paper p-6 shadow-panel" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-2xl font-medium">Add inspiration</h2>

        <div className="mt-4 flex gap-2">
          <button type="button" className={`chip ${tab === 'url' ? 'chip-active' : ''}`} onClick={() => setTab('url')}>From URL</button>
          <button type="button" className={`chip ${tab === 'image' ? 'chip-active' : ''}`} onClick={() => setTab('image')}>Upload image</button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {tab === 'url' ? (
            <div>
              <label className="label-mono">Page URL — full-page screenshot is captured automatically</label>
              <input className="field mt-1" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
            </div>
          ) : (
            <div>
              <label className="label-mono">Screenshot / image</label>
              <input className="field mt-1" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mono">Design type</label>
              <select className="field mt-1" value={typeId} onChange={e => setTypeId(e.target.value)}>
                <option value="">—</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-mono">Brand context</label>
              <select className="field mt-1" value={brandId} onChange={e => setBrandId(e.target.value)}>
                <option value="">—</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label-mono">Title (optional — page title or AI suggestion fills it)</label>
            <input className="field mt-1" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="label-mono">What do you like about this?</label>
            <textarea className="field mt-1" rows={2} placeholder="The thing that made you save it — the analysis weighs this." value={note} onChange={e => setNote(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={autoAnalyze} onChange={e => setAutoAnalyze(e.target.checked)} />
            Run designer analysis now (drafts land in the review queue either way)
          </label>

          {error && <p className="text-sm text-accent">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-primary" disabled={busy}>
              {step === 'capturing' ? (tab === 'url' ? 'Capturing page…' : 'Uploading…')
                : step === 'analyzing' ? 'Analyzing…'
                : step === 'done' ? 'Added ✓'
                : 'Add to review queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
