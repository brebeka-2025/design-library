import { useState } from 'react'

function Cmd({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="group mt-1 flex w-full items-center justify-between gap-3 rounded-md border border-line bg-ink px-3 py-2 text-left"
      onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
      title="Click to copy"
    >
      <code className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-paper">{children}</code>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-paper/50 group-hover:text-paper">{copied ? 'copied ✓' : 'copy'}</span>
    </button>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-deep font-mono text-[12px] font-medium">{n}</div>
      <div className="min-w-0 flex-1 pb-8">
        <p className="font-display text-lg font-medium">{title}</p>
        <div className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</div>
      </div>
    </div>
  )
}

export default function Guide() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-medium">How to use DesignOS</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Two tools, one system. <strong className="text-ink">This app is the memory</strong> — it collects your taste, your brand rules, and what critiques teach us. <strong className="text-ink">Claude Code is the workshop</strong> — it's where designs actually get built, on your Mac. The DESIGN.md file is the handoff between them: this app writes it, Claude Code reads it.
      </p>

      <h2 className="mt-10 font-display text-xl font-medium">Every week: feed the memory (this app)</h2>
      <div className="mt-4">
        <Step n="1" title="Save inspiration as you browse">
          See a site or design you like? <em>+ Add inspiration</em> → paste the URL (screenshot is captured automatically) or upload an image. Write one line about why you saved it — the analysis weighs your note.
        </Step>
        <Step n="2" title="Approve from the review queue">
          The AI drafts the designer analysis, palette, keywords, and brief. Fix anything it got wrong, then <em>Approve into library</em>. Nothing counts as your taste until you approve it.
        </Step>
        <Step n="3" title="Keep brands and profile current">
          Run the wizard once per brand (AI prefill from an existing site gets you 80% there). After design critiques, save the agreed rulings to the <em>Style profile</em> and approve. Both ride along in every export automatically.
        </Step>
      </div>

      <h2 className="mt-6 font-display text-xl font-medium">Per project: build in the workshop (Claude Code)</h2>
      <div className="mt-4">
        <Step n="1" title="Export a DESIGN.md from this app">
          From a library item (inspiration + brand + learned taste) or from a brand card (brand truth + learned taste). This file IS your design direction.
        </Step>
        <Step n="2" title="Make a project folder and drop the file in">
          In Terminal on your Mac:
          <Cmd>{'mkdir -p ~/Documents/"Bobs Projects"/my-new-project\nmv ~/Downloads/DESIGN-*.md ~/Documents/"Bobs Projects"/my-new-project/DESIGN.md'}</Cmd>
        </Step>
        <Step n="3" title="Open Claude Code in that folder">
          <Cmd>{'cd ~/Documents/"Bobs Projects"/my-new-project && claude'}</Cmd>
        </Step>
        <Step n="4" title="One command inside Claude Code, once per project">
          This writes PRODUCT.md (audience, goal) so later design commands know the context:
          <Cmd>/impeccable init</Cmd>
          You do NOT need to install anything again — Impeccable, Higgsfield, and your design-principles skill are installed globally on your Mac and load in every session.
        </Step>
        <Step n="5" title="Paste the build prompt">
          <Cmd>{'Build a landing page prototype for [PROJECT]. DESIGN.md in this folder is\nthe committed visual world — follow it, including the Learned taste section.\nContent source: [URL] — content ONLY, take no visual cues from it.\nCreate 3 variants with different body structures. Use Higgsfield for the\nhero image based on the image recipe. Show all 3 on a dev server.'}</Cmd>
        </Step>
        <Step n="6" title="Pick, then iterate with the design commands">
          <Cmd>{'/impeccable critique   ← scored read on what\'s weak\n/impeccable bolder     ← when it\'s too safe\n/impeccable quieter    ← when it\'s too loud\n/impeccable polish     ← final pass before shipping'}</Cmd>
        </Step>
        <Step n="7" title="Close the loop back here">
          After the build, we critique the result together. Agreed rulings get saved to the <em>Style profile</em> — so the next project starts smarter than this one.
        </Step>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-white/60 p-5 text-sm leading-relaxed text-ink-soft">
        <p className="label-mono mb-2">Why isn't building inside this app?</p>
        Building needs your Mac: a filesystem, a dev server, running code. That's what Claude Code is. A future version of this app may hand off to a builder automatically ("Generate" button) — until then, the recipe above is the bridge, and it's the same 5 commands every time.
      </div>
    </div>
  )
}
