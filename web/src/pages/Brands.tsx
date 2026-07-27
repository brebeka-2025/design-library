import { useState } from 'react'
import { useBrands, useCurrentProfile } from '../hooks/useData'
import { buildBrandDesignMd, downloadText } from '../lib/designmd'
import BrandWizard from '../components/BrandWizard'
import type { Brand } from '../lib/types'

export default function Brands() {
  const brands = useBrands().data ?? []
  const profile = useCurrentProfile()
  const [wizard, setWizard] = useState<{ open: boolean; brand: Brand | null }>({ open: false, brand: null })

  function hasGuidelines(b: Brand): boolean {
    return !!(b.tokens?.colors?.length || b.tokens?.typography?.display || b.voice_rules)
  }

  function summarize(b: Brand): string {
    const parts: string[] = []
    if (b.tokens?.colors?.length) parts.push(`${b.tokens.colors.length} colors`)
    if (b.tokens?.typography?.display) parts.push(b.tokens.typography.display)
    if (b.voice_rules) parts.push('voice rules set')
    return parts.join(' · ')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Brands</h1>
          <p className="mt-1 text-sm text-ink-soft">Brand constraints merge into briefs and DESIGN.md exports. Inspiration stays unconstrained; output respects the brand.</p>
        </div>
        <button className="btn-ghost shrink-0" onClick={() => setWizard({ open: true, brand: null })}>+ New brand</button>
      </div>

      <div className="mt-6 space-y-3">
        {brands.map(b => (
          <div key={b.id} className="rounded-xl border border-line bg-white p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="font-display text-lg font-medium">{b.name}</p>
                  {!!b.tokens?.colors?.length && (
                    <span className="flex gap-1">
                      {b.tokens.colors.slice(0, 5).map((c, i) => (
                        <span key={i} title={`${c.name} ${c.hex}`} className="inline-block h-3.5 w-3.5 rounded-sm border border-line" style={{ backgroundColor: c.hex }} />
                      ))}
                    </span>
                  )}
                </div>
                {hasGuidelines(b) ? (
                  <p className="truncate font-mono text-[11px] text-ink-faint">{b.key} — {summarize(b)}</p>
                ) : (
                  <p className="truncate font-mono text-[11px] text-ink-soft">{b.key} — <span className="text-accent">guidelines not set</span></p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {hasGuidelines(b) ? (
                  <>
                    <button className="btn-secondary" onClick={() => downloadText(`DESIGN-${b.key}.md`, buildBrandDesignMd(b, profile))}>
                      Export DESIGN.md
                    </button>
                    <button className="btn-ghost" onClick={() => setWizard({ open: true, brand: b })}>Edit</button>
                  </>
                ) : (
                  <button className="btn-secondary" onClick={() => setWizard({ open: true, brand: b })}>
                    Set up guidelines →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {wizard.open && <BrandWizard brand={wizard.brand} onClose={() => setWizard({ open: false, brand: null })} />}
    </div>
  )
}
