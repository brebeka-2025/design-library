import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useBrands } from '../hooks/useData'
import type { Brand } from '../lib/types'

export default function Brands() {
  const brands = useBrands().data ?? []
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Brand | null>(null)
  const [voice, setVoice] = useState('')
  const [tokensText, setTokensText] = useState('{}')
  const [err, setErr] = useState('')

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return
      let tokens: Record<string, unknown>
      try { tokens = JSON.parse(tokensText) } catch { throw new Error('Tokens must be valid JSON') }
      const { error } = await supabase.from('brands').update({ voice_rules: voice || null, tokens }).eq('id', editing.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brands'] }); setEditing(null); setErr('') },
    onError: e => setErr(e instanceof Error ? e.message : 'Save failed'),
  })

  function open(b: Brand) {
    setEditing(b)
    setVoice(b.voice_rules ?? '')
    setTokensText(JSON.stringify(b.tokens ?? {}, null, 2))
    setErr('')
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-medium">Brands</h1>
      <p className="mt-1 text-sm text-ink-soft">Brand constraints merge into briefs and DESIGN.md exports. Inspiration stays unconstrained; output respects the brand.</p>

      <div className="mt-6 space-y-3">
        {brands.map(b => (
          <div key={b.id} className="rounded-xl border border-line bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-medium">{b.name}</p>
                <p className="font-mono text-[11px] text-ink-faint">{b.key}{b.notes ? ` — ${b.notes}` : ''}</p>
              </div>
              <button className="btn-ghost" onClick={() => open(b)}>Edit</button>
            </div>
            {editing?.id === b.id && (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <div>
                  <label className="label-mono">Voice / design rules (prose — pulled into DESIGN.md)</label>
                  <textarea className="field mt-1" rows={4} value={voice} onChange={e => setVoice(e.target.value)} />
                </div>
                <div>
                  <label className="label-mono">Design tokens (JSON — colors, fonts, spacing)</label>
                  <textarea className="field mt-1 font-mono text-xs" rows={6} value={tokensText} onChange={e => setTokensText(e.target.value)} />
                </div>
                {err && <p className="text-sm text-accent">{err}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>Save</button>
                  <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
