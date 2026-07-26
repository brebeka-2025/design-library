import { useMemo, useState } from 'react'
import { useDesignTypes, useFamilies, useItems } from '../hooks/useData'
import type { Item } from '../lib/types'
import ItemImage from '../components/ItemImage'
import ItemDetail from '../components/ItemDetail'

export default function Library() {
  const items = useItems('approved').data ?? []
  const types = useDesignTypes().data ?? []
  const families = useFamilies().data ?? []

  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [openItem, setOpenItem] = useState<Item | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(i =>
      (!typeFilter || i.design_type_id === typeFilter) &&
      (!familyFilter || i.aesthetic_family_id === familyFilter) &&
      (!q || i.title.toLowerCase().includes(q) || i.keywords.some(k => k.toLowerCase().includes(q)))
    )
  }, [items, typeFilter, familyFilter, search])

  const typeCount = (id: string) => items.filter(i => i.design_type_id === id).length
  const famCount = (id: string) => items.filter(i => i.aesthetic_family_id === id).length
  const familyName = (id: string | null) => families.find(f => f.id === id)?.name

  return (
    <div className="flex gap-8">
      {/* secondary nav: design types */}
      <div className="w-44 shrink-0">
        <p className="label-mono mb-3">Design type</p>
        <button
          className={`block w-full rounded-md px-2.5 py-1.5 text-left text-sm ${!typeFilter ? 'bg-paper-deep font-medium' : 'text-ink-soft hover:bg-paper-deep/60'}`}
          onClick={() => setTypeFilter(null)}
        >
          All <span className="float-right font-mono text-[11px] text-ink-faint">{items.length}</span>
        </button>
        {types.map(t => (
          <button
            key={t.id}
            className={`block w-full rounded-md px-2.5 py-1.5 text-left text-sm ${typeFilter === t.id ? 'bg-paper-deep font-medium' : 'text-ink-soft hover:bg-paper-deep/60'}`}
            onClick={() => setTypeFilter(f => (f === t.id ? null : t.id))}
          >
            {t.name} <span className="float-right font-mono text-[11px] text-ink-faint">{typeCount(t.id)}</span>
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-medium">Library</h1>
          <input
            className="field max-w-xs"
            placeholder="Search titles and keywords…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {families.filter(f => famCount(f.id) > 0).map(f => (
            <button
              key={f.id}
              className={`chip ${familyFilter === f.id ? 'chip-active' : ''}`}
              onClick={() => setFamilyFilter(v => (v === f.id ? null : f.id))}
            >
              {f.name} <span className="opacity-60">{famCount(f.id)}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="font-display text-xl text-ink-soft">Nothing here yet.</p>
            <p className="mt-2 text-sm text-ink-faint">
              {items.length === 0 ? 'Add inspiration and approve it from the review queue.' : 'No items match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item, idx) => (
              <button
                key={item.id}
                className="group overflow-hidden rounded-xl border border-line bg-white text-left shadow-card transition-shadow hover:shadow-panel"
                onClick={() => setOpenItem(item)}
              >
                <ItemImage path={item.image_path} alt={item.title} className="h-44 w-full border-b border-line" />
                <div className="p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-display text-lg font-medium group-hover:text-accent">{item.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">{String(idx + 1).padStart(2, '0')} / {filtered.length}</span>
                  </div>
                  {item.keywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.keywords.slice(0, 3).map(k => (
                        <span key={k} className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">{k}</span>
                      ))}
                      {item.keywords.length > 3 && <span className="font-mono text-[10px] text-ink-faint">+{item.keywords.length - 3}</span>}
                    </div>
                  )}
                  {familyName(item.aesthetic_family_id) && (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-accent">◆ {familyName(item.aesthetic_family_id)}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {openItem && <ItemDetail item={items.find(i => i.id === openItem.id) ?? openItem} onClose={() => setOpenItem(null)} />}
    </div>
  )
}
