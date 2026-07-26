import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { analyzeBrand } from '../lib/api'
import type { Brand, BrandTokens, BrandColor } from '../lib/types'

const STEPS = ['Identity', 'Colors', 'Typography', 'Layout', 'Imagery & motion', 'Voice', 'Never-do'] as const

const DEFAULT_NEVER = ['No Inter font', 'No purple-to-blue gradients', 'No 3D SaaS blobs', 'No gradient text']

interface Props {
  brand: Brand | null // null = creating new
  onClose: () => void
}

export default function BrandWizard({ brand, onClose }: Props) {
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(brand?.name ?? '')
  const [notes, setNotes] = useState(brand?.notes ?? '')
  const [voice, setVoice] = useState(brand?.voice_rules ?? '')
  const [t, setT] = useState<BrandTokens>(() => ({
    never: brand?.tokens?.never ?? DEFAULT_NEVER,
    ...brand?.tokens,
  }))
  const [err, setErr] = useState('')

  // AI prefill
  const [prefillUrl, setPrefillUrl] = useState('')
  const [prefilling, setPrefilling] = useState(false)

  function patch(p: Partial<BrandTokens>) {
    setT(prev => ({ ...prev, ...p }))
  }

  async function runPrefill() {
    if (!/^https?:\/\//i.test(prefillUrl)) { setErr('Enter a full URL (https://…)'); return }
    setPrefilling(true)
    setErr('')
    try {
      const { draft } = await analyzeBrand({ url: prefillUrl })
      const d = draft as BrandTokens & { voice_rules?: string }
      setT(prev => ({
        ...prev,
        positioning: d.positioning ?? prev.positioning,
        audience: d.audience ?? prev.audience,
        colors: d.colors?.length ? d.colors : prev.colors,
        typography: { ...prev.typography, ...d.typography },
        layout: { ...prev.layout, ...d.layout },
        imagery: d.imagery ?? prev.imagery,
        motion: d.motion ?? prev.motion,
        never: [...new Set([...(prev.never ?? []), ...(d.never ?? [])])],
      }))
      if (d.voice_rules && !voice) setVoice(d.voice_rules)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Prefill failed')
    } finally {
      setPrefilling(false)
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('The brand needs a name')
      const row = { name: trimmed, notes: notes.trim() || null, voice_rules: voice.trim() || null, tokens: t }
      if (brand) {
        const { error } = await supabase.from('brands').update(row).eq('id', brand.id)
        if (error) throw error
      } else {
        const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        const { error } = await supabase.from('brands').insert({ ...row, key })
        if (error) throw error.code === '23505' ? new Error(`A brand with key "${key}" already exists`) : error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brands'] }); onClose() },
    onError: e => setErr(e instanceof Error ? e.message : 'Save failed'),
  })

  // ---- color row helpers ----
  const colors = t.colors ?? []
  function setColor(i: number, p: Partial<BrandColor>) {
    patch({ colors: colors.map((c, ix) => (ix === i ? { ...c, ...p } : c)) })
  }

  const ty = t.typography ?? {}
  const ly = t.layout ?? {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-paper shadow-panel" onClick={e => e.stopPropagation()}>
        <div className="border-b border-line px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-medium">{brand ? `Edit ${brand.name}` : 'New brand'}</h2>
            <button className="text-ink-faint hover:text-ink" onClick={onClose}>✕</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STEPS.map((s, i) => (
              <button key={s} className={`chip ${i === step ? 'chip-active' : ''}`} onClick={() => setStep(i)}>
                {i + 1} {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="label-mono">Brand name</label>
                <input className="field mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="RhinoGuard" autoFocus />
              </div>
              <div>
                <label className="label-mono">One-line positioning</label>
                <input className="field mt-1" value={t.positioning ?? ''} onChange={e => patch({ positioning: e.target.value })} placeholder="What this brand is, in one sentence" />
              </div>
              <div>
                <label className="label-mono">Audience</label>
                <input className="field mt-1" value={t.audience ?? ''} onChange={e => patch({ audience: e.target.value })} placeholder="Who it speaks to" />
              </div>
              <div>
                <label className="label-mono">Notes (internal)</label>
                <input className="field mt-1" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="rounded-lg border border-line bg-white/50 p-4">
                <p className="label-mono">AI prefill (optional)</p>
                <p className="mt-1 text-sm text-ink-soft">Point at an existing site and Claude drafts every step from what it sees. Everything stays editable — nothing saves until you finish.</p>
                <div className="mt-2 flex gap-2">
                  <input className="field" placeholder="https://existing-brand-site.com" value={prefillUrl} onChange={e => setPrefillUrl(e.target.value)} />
                  <button className="btn-ghost shrink-0" onClick={runPrefill} disabled={prefilling}>
                    {prefilling ? 'Analyzing…' : 'Prefill'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">Each color gets a usage rule — where it's allowed to appear. That rule is what keeps output disciplined.</p>
              {colors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="color" className="h-9 w-9 shrink-0 cursor-pointer rounded border border-line bg-white" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#000000'} onChange={e => setColor(i, { hex: e.target.value })} />
                  <input className="field w-28" value={c.hex} onChange={e => setColor(i, { hex: e.target.value })} placeholder="#000000" />
                  <input className="field w-36" value={c.name} onChange={e => setColor(i, { name: e.target.value })} placeholder="Role (Primary…)" />
                  <input className="field flex-1" value={c.usage} onChange={e => setColor(i, { usage: e.target.value })} placeholder="Usage rule" />
                  <button className="text-ink-faint hover:text-accent" onClick={() => patch({ colors: colors.filter((_, ix) => ix !== i) })}>✕</button>
                </div>
              ))}
              <button className="btn-ghost" onClick={() => patch({ colors: [...colors, { name: '', hex: '#', usage: '' }] })}>+ Add color</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div><label className="label-mono">Display / heading face</label>
                <input className="field mt-1" value={ty.display ?? ''} onChange={e => patch({ typography: { ...ty, display: e.target.value } })} placeholder='e.g. "Bold condensed geometric sans (Univers-like)"' /></div>
              <div><label className="label-mono">Body face</label>
                <input className="field mt-1" value={ty.body ?? ''} onChange={e => patch({ typography: { ...ty, body: e.target.value } })} /></div>
              <div><label className="label-mono">Mono / label face (optional)</label>
                <input className="field mt-1" value={ty.mono ?? ''} onChange={e => patch({ typography: { ...ty, mono: e.target.value } })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label-mono">Weights</label>
                  <input className="field mt-1" value={ty.weights ?? ''} onChange={e => patch({ typography: { ...ty, weights: e.target.value } })} placeholder="400 / 600 / 800" /></div>
                <div><label className="label-mono">Min body size</label>
                  <input className="field mt-1" value={ty.min_body_px ?? ''} onChange={e => patch({ typography: { ...ty, min_body_px: e.target.value } })} placeholder="16px" /></div>
                <div><label className="label-mono">Fallbacks</label>
                  <input className="field mt-1" value={ty.fallbacks ?? ''} onChange={e => patch({ typography: { ...ty, fallbacks: e.target.value } })} placeholder="Arial, sans-serif" /></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div><label className="label-mono">Density</label>
                <input className="field mt-1" value={ly.density ?? ''} onChange={e => patch({ layout: { ...ly, density: e.target.value } })} placeholder='e.g. "generous whitespace, calm pacing"' /></div>
              <div><label className="label-mono">Corner radius</label>
                <input className="field mt-1" value={ly.radius ?? ''} onChange={e => patch({ layout: { ...ly, radius: e.target.value } })} placeholder='e.g. "sharp corners" or "8px max"' /></div>
              <div><label className="label-mono">Shadows / elevation</label>
                <input className="field mt-1" value={ly.shadows ?? ''} onChange={e => patch({ layout: { ...ly, shadows: e.target.value } })} placeholder='e.g. "borders over shadows; one subtle card shadow"' /></div>
              <div><label className="label-mono">Spacing rhythm</label>
                <input className="field mt-1" value={ly.spacing ?? ''} onChange={e => patch({ layout: { ...ly, spacing: e.target.value } })} placeholder='e.g. "tight groups, generous section separation"' /></div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div><label className="label-mono">Imagery rules</label>
                <textarea className="field mt-1" rows={4} value={t.imagery ?? ''} onChange={e => patch({ imagery: e.target.value })} placeholder='e.g. "Documentary-industrial photography: real people, real equipment. No stock handshakes, no abstraction."' /></div>
              <div><label className="label-mono">Motion character</label>
                <textarea className="field mt-1" rows={3} value={t.motion ?? ''} onChange={e => patch({ motion: e.target.value })} placeholder='e.g. "Restrained. One authored moment per page, exponential ease-out. Nothing bounces."' /></div>
            </div>
          )}

          {step === 5 && (
            <div>
              <label className="label-mono">Voice / tone rules</label>
              <textarea className="field mt-1" rows={10} value={voice} onChange={e => setVoice(e.target.value)} placeholder="Plain, direct, kitchen-table clear. Recognition over persuasion. No corporate filler, no positioning jargon. (For Driver/DIS, paste the relevant brand-voice.md rules here.)" />
            </div>
          )}

          {step === 6 && (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">Anti-references. These land in every brief and DESIGN.md for this brand.</p>
              {(t.never ?? []).map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="field" value={n} onChange={e => patch({ never: (t.never ?? []).map((x, ix) => ix === i ? e.target.value : x) })} />
                  <button className="text-ink-faint hover:text-accent" onClick={() => patch({ never: (t.never ?? []).filter((_, ix) => ix !== i) })}>✕</button>
                </div>
              ))}
              <button className="btn-ghost" onClick={() => patch({ never: [...(t.never ?? []), ''] })}>+ Add rule</button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <div className="text-sm text-accent">{err}</div>
          <div className="flex gap-2">
            {step > 0 && <button className="btn-ghost" onClick={() => setStep(s => s - 1)}>Back</button>}
            {step < STEPS.length - 1 ? (
              <button className="btn-primary" onClick={() => setStep(s => s + 1)}>Next</button>
            ) : (
              <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : brand ? 'Save brand' : 'Create brand'}
              </button>
            )}
            <button className="btn-ghost" onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
              Save & close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
