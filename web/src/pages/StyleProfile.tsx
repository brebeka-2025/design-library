import { useState } from 'react'
import { useProfiles, useSaveProfileDraft, useApproveProfile, useDiscardProfileDraft } from '../hooks/useData'

const STARTER = `# Bob's style profile — v1

## What I gravitate toward
- (add learnings from critiques here, e.g. "warm paper grounds, serif display, restrained single-accent palettes")

## What consistently fails for me
- (e.g. "minimal layouts without strong imagery read as empty, not calm")

## Standing decisions from critiques
- (dated rulings we agreed on, e.g. "2026-07-27: one filled CTA per view; active nav never dressed as a button")
`

export default function StyleProfile() {
  const profiles = useProfiles().data ?? []
  const current = profiles.find(p => p.status === 'approved') ?? null
  const draft = profiles.find(p => p.status === 'draft') ?? null
  const saveDraft = useSaveProfileDraft()
  const approve = useApproveProfile()
  const discard = useDiscardProfileDraft()

  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')

  const nextVersion = (profiles[0]?.version ?? 0) + 1

  function startEdit() {
    setText(draft?.content ?? current?.content ?? STARTER)
    setEditing(true)
    setErr('')
  }

  async function save() {
    try {
      await saveDraft.mutateAsync({ content: text, existingDraftId: draft?.id, nextVersion })
      setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Style profile</h1>
          <p className="mt-1 text-sm text-ink-soft">
            The living record of what critiques have taught the system about your taste. The current approved version is embedded in every DESIGN.md export. Drafts stay drafts until you approve them.
          </p>
        </div>
        {!editing && (
          <button className="btn-secondary shrink-0" onClick={startEdit}>
            {draft ? 'Edit draft' : current ? 'Propose update' : 'Start profile'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-6">
          <label className="label-mono">Draft — v{draft?.version ?? nextVersion}</label>
          <textarea
            className="field mt-1 font-mono text-[13px] leading-relaxed"
            rows={22}
            value={text}
            onChange={e => setText(e.target.value)}
          />
          {err && <p className="mt-2 text-sm text-accent">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={save} disabled={saveDraft.isPending}>Save draft</button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {draft && (
            <div className="mt-6 rounded-xl border border-accent/40 bg-accent-soft/30 p-5">
              <div className="flex items-center justify-between">
                <p className="label-mono text-accent">Draft awaiting your approval — v{draft.version}</p>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => approve.mutate(draft.id)} disabled={approve.isPending}>
                    Approve as current
                  </button>
                  <button className="btn-ghost" onClick={() => discard.mutate(draft.id)} disabled={discard.isPending}>Discard</button>
                </div>
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink">{draft.content}</pre>
            </div>
          )}

          {current ? (
            <div className="mt-6 rounded-xl border border-line bg-white p-5 shadow-card">
              <p className="label-mono">Current — v{current.version} · approved {new Date(current.created_at).toLocaleDateString()}</p>
              <pre className="mt-3 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink">{current.content}</pre>
            </div>
          ) : !draft && (
            <div className="mt-16 text-center">
              <p className="font-display text-xl text-ink-soft">No profile yet.</p>
              <p className="mt-2 text-sm text-ink-faint">Start it after your first critique session — even three honest bullets change every future export.</p>
            </div>
          )}

          {profiles.filter(p => p.status === 'superseded').length > 0 && (
            <div className="mt-8">
              <p className="label-mono">History</p>
              <div className="mt-2 space-y-1">
                {profiles.filter(p => p.status === 'superseded').map(p => (
                  <details key={p.id} className="rounded-md border border-line bg-white/50 px-4 py-2">
                    <summary className="cursor-pointer font-mono text-[12px] text-ink-soft">
                      v{p.version} — {new Date(p.created_at).toLocaleDateString()}
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-soft">{p.content}</pre>
                  </details>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
