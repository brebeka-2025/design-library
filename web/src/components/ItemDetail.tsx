import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Item } from '../lib/types'
import { useBrands, useDesignTypes, useFamilies, useUpdateItem, useCurrentProfile } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { analyzeItem } from '../lib/api'
import { buildDesignMd, downloadText } from '../lib/designmd'
import ItemImage from './ItemImage'

function CopyButton({ label, text }: { label: string; text: string | null }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="btn-ghost"
      disabled={!text}
      onClick={() => {
        if (!text) return
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? 'Copied ✓' : label}
    </button>
  )
}

export default function ItemDetail({ item, onClose }: { item: Item; onClose: () => void }) {
  const brands = useBrands().data ?? []
  const types = useDesignTypes().data ?? []
  const families = useFamilies().data ?? []
  const update = useUpdateItem()
  const profile = useCurrentProfile()
  const qc = useQueryClient()

  const [draft, setDraft] = useState<Item>(item)
  const [analyzing, setAnalyzing] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => setDraft(item), [item])

  const family = families.find(f => f.id === draft.aesthetic_family_id) ?? null
  const brand = brands.find(b => b.id === draft.brand_id) ?? null
  const dtype = types.find(t => t.id === draft.design_type_id) ?? null
  const dirty = JSON.stringify(draft) !== JSON.stringify(item)

  function set<K extends keyof Item>(key: K, value: Item[K]) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  async function save(extra?: Partial<Item>) {
    setErr('')
    const patch: Partial<Item> = {
      title: draft.title,
      design_type_id: draft.design_type_id,
      aesthetic_family_id: draft.aesthetic_family_id,
      brand_id: draft.brand_id,
      bob_note: draft.bob_note,
      keywords: draft.keywords,
      designer_analysis: draft.designer_analysis,
      image_recipe: draft.image_recipe,
      brief: draft.brief,
      ...extra,
    }
    try {
      await update.mutateAsync({ id: item.id, patch })
      if (extra?.status) onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function discard() {
    if (!window.confirm('Discard this item? The screenshot and draft are deleted permanently.')) return
    setErr('')
    try {
      if (item.image_path) {
        await supabase.storage.from('inspiration').remove([item.image_path])
      }
      const { error } = await supabase.from('items').delete().eq('id', item.id)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['items'] })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Discard failed')
    }
  }

  async function runAnalysis() {
    setAnalyzing(true)
    setErr('')
    try {
      await analyzeItem(item.id)
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['families'] })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const tokens = draft.style_tokens || {}

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-paper shadow-panel" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
              draft.status === 'approved' ? 'bg-ink text-paper' : draft.status === 'pending_review' ? 'bg-accent text-paper' : 'bg-paper-deep text-ink-soft'
            }`}>{draft.status.replace('_', ' ')}</span>
            {draft.analyzed_at && <span className="font-mono text-[10px] text-ink-faint">analyzed {new Date(draft.analyzed_at).toLocaleDateString()}</span>}
          </div>
          <button className="text-ink-faint hover:text-ink" onClick={onClose}>✕ close</button>
        </div>

        <div className="px-6 py-5">
          <ItemImage path={draft.image_path} alt={draft.title} className="max-h-96 w-full rounded-lg border border-line" />

          <input
            className="mt-5 w-full border-none bg-transparent font-display text-3xl font-medium outline-none"
            value={draft.title}
            onChange={e => set('title', e.target.value)}
          />
          {draft.source_url && (
            <a href={draft.source_url} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-ink-faint hover:text-accent">
              {draft.source_url}
            </a>
          )}

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div>
              <label className="label-mono">Type</label>
              <select className="field mt-1" value={draft.design_type_id ?? ''} onChange={e => set('design_type_id', e.target.value || null)}>
                <option value="">—</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-mono">Family</label>
              <select className="field mt-1" value={draft.aesthetic_family_id ?? ''} onChange={e => set('aesthetic_family_id', e.target.value || null)}>
                <option value="">—</option>
                {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-mono">Brand</label>
              <select className="field mt-1" value={draft.brand_id ?? ''} onChange={e => set('brand_id', e.target.value || null)}>
                <option value="">—</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="label-mono">What I like about this</label>
            <textarea className="field mt-1" rows={2} value={draft.bob_note ?? ''} onChange={e => set('bob_note', e.target.value)} />
          </div>

          {!!tokens.palette?.length && (
            <div className="mt-5">
              <label className="label-mono">Palette</label>
              <div className="mt-2 flex gap-2">
                {tokens.palette.map((hex, i) => (
                  <button
                    key={i}
                    title={`${hex} — click to copy`}
                    onClick={() => navigator.clipboard.writeText(hex)}
                    className="h-9 w-9 rounded-md border border-line"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          )}

          {(tokens.fonts || tokens.spacing || tokens.layout_pattern || tokens.motion) && (
            <div className="mt-4 rounded-lg border border-line bg-white/50 p-4 text-sm">
              {tokens.fonts?.display && <p><span className="label-mono mr-2">Display</span>{tokens.fonts.display}</p>}
              {tokens.fonts?.body && <p className="mt-1"><span className="label-mono mr-2">Body</span>{tokens.fonts.body}</p>}
              {tokens.fonts?.mono_accent && <p className="mt-1"><span className="label-mono mr-2">Mono</span>{tokens.fonts.mono_accent}</p>}
              {tokens.spacing && <p className="mt-1"><span className="label-mono mr-2">Spacing</span>{tokens.spacing}</p>}
              {tokens.layout_pattern && <p className="mt-1"><span className="label-mono mr-2">Layout</span>{tokens.layout_pattern}</p>}
              {tokens.motion && <p className="mt-1"><span className="label-mono mr-2">Motion</span>{tokens.motion}</p>}
            </div>
          )}

          <div className="mt-4">
            <label className="label-mono">Keywords (comma-separated)</label>
            <input
              className="field mt-1 font-mono text-xs"
              value={(draft.keywords ?? []).join(', ')}
              onChange={e => set('keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
          </div>

          <div className="mt-4">
            <label className="label-mono">Designer analysis</label>
            <textarea className="field mt-1 leading-relaxed" rows={8} value={draft.designer_analysis ?? ''} onChange={e => set('designer_analysis', e.target.value)} placeholder="Run analysis to draft this, or write your own." />
          </div>

          <div className="mt-4">
            <label className="label-mono">Image recipe (Higgsfield)</label>
            <textarea className="field mt-1 font-mono text-xs leading-relaxed" rows={4} value={draft.image_recipe ?? ''} onChange={e => set('image_recipe', e.target.value)} />
          </div>

          <div className="mt-4">
            <label className="label-mono">Brief</label>
            <textarea className="field mt-1 leading-relaxed" rows={5} value={draft.brief ?? ''} onChange={e => set('brief', e.target.value)} />
          </div>

          {err && <p className="mt-3 text-sm text-accent">{err}</p>}

          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
            <button className="btn-ghost" onClick={runAnalysis} disabled={analyzing || !draft.image_path}>
              {analyzing ? 'Analyzing…' : draft.analyzed_at ? 'Re-run analysis' : 'Run analysis'}
            </button>
            <CopyButton label="Copy brief" text={draft.brief} />
            <CopyButton label="Copy image prompt" text={draft.image_recipe} />
            <button className="btn-ghost" onClick={() => downloadText(`DESIGN-${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`, buildDesignMd(draft, family, brand, dtype, profile))}>
              Export DESIGN.md
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 pb-8">
            {dirty && <button className="btn-primary" onClick={() => save()} disabled={update.isPending}>Save changes</button>}
            {draft.status === 'pending_review' && (
              <>
                <button className="btn-primary" onClick={() => save({ status: 'approved' })} disabled={update.isPending}>
                  Approve into library
                </button>
                <button className="btn-ghost text-accent" onClick={discard} disabled={update.isPending}>
                  Discard
                </button>
              </>
            )}
            {draft.status === 'approved' && (
              <button className="btn-ghost" onClick={() => save({ status: 'archived' })} disabled={update.isPending}>Archive</button>
            )}
            {draft.status === 'archived' && (
              <button className="btn-ghost" onClick={() => save({ status: 'approved' })} disabled={update.isPending}>Restore to library</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
