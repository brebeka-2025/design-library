import { useState } from 'react'
import { useItems } from '../hooks/useData'
import type { Item } from '../lib/types'
import ItemImage from '../components/ItemImage'
import ItemDetail from '../components/ItemDetail'

export default function Review() {
  const pending = useItems('pending_review').data ?? []
  const [openItem, setOpenItem] = useState<Item | null>(null)

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-medium">Review queue</h1>
      <p className="mt-1 text-sm text-ink-soft">Drafts stay drafts until you approve them. Edit anything the analysis got wrong, then approve.</p>

      {pending.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-display text-xl text-ink-soft">Queue is clear.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {pending.map(item => (
            <button
              key={item.id}
              className="flex w-full items-center gap-4 rounded-xl border border-line bg-white p-3 text-left shadow-card transition-shadow hover:shadow-panel"
              onClick={() => setOpenItem(item)}
            >
              <ItemImage path={item.image_path} alt={item.title} className="h-20 w-32 shrink-0 rounded-md border border-line" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-medium">{item.title}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                  {item.analyzed_at ? 'analysis drafted — review and approve' : 'not yet analyzed'}
                  {item.source_url ? ` · ${new URL(item.source_url).hostname}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-paper">review</span>
            </button>
          ))}
        </div>
      )}

      {openItem && <ItemDetail item={pending.find(i => i.id === openItem.id) ?? openItem} onClose={() => setOpenItem(null)} />}
    </div>
  )
}
