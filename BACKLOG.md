# DesignOS backlog

Living list of planned updates, small fixes, and housekeeping. Started 2026-07-27 after the v1 build weekend. When working with Claude (Code or Cowork), point it here: "pick up X from BACKLOG.md."

## Small fixes / polish

- [ ] Bob's button edits (Bob has a list — bring to next session or run through The Crit)
- [ ] Friendlier error when URL capture hits a bot-wall: "This site blocks automated capture — paste a screenshot instead" (currently raw Playwright timeout text)
- [ ] Responsive/mobile pass — The Crit split-screen especially; app is desktop-first today
- [ ] Crit sessions: rename title, mark closed/archived (status column exists, unused)
- [ ] Review queue: analyze-all button for a batch of un-analyzed items
- [ ] Library: pagination or lazy loading once the library passes ~100 items

## Features (v2)

- [ ] **Generate button** — the end-state: pick item + brand + intent in-app, builder runs in the background, variants come back for review. Today's manual bridge: export DESIGN.md → Claude Code (see How to use page).
- [ ] **Usage tracking UI** — `item_usages` table exists, no UI. Record "used in project X, rated N/5, note" per item; dissatisfaction is training data (the RhinoGuard lesson).
- [ ] **AI-proposed style profile updates** — aggregate new approved items + notes + usage ratings since last profile version → draft the profile diff automatically → Bob approves. (Today: rulings come from crits; this adds learning from the library itself.)
- [ ] **In-app Higgsfield** — generate hero images from an item's image recipe directly, instead of copy-paste into the Higgsfield workflow.
- [ ] **Tweaks bar** — Claude Design-style live adjusters (fonts, accent, spacing) on generated variants. Depends on Generate button.
- [ ] **Semantic search** — embeddings over analyses/keywords: "quiet minimal with serif" finds items no keyword matches.
- [ ] **Chrome extension** — one "Save to my library" button in the browser: current tab → type picker → note → capture pipeline. Also serves the future bookmarks app. (~a day; queued behind proof of regular library use.)
- [ ] Design-type manager UI — only if adding types becomes frequent; today a new type is a deliberate ask (each type carries a curated format profile).
- [ ] Crit protocol toggle: presenter-first option (Bob presents before critic describes) if the hybrid rhythm doesn't stick after a few sessions.

## Housekeeping / operations

- [ ] Delete duplicate Supabase project `design-library-app` (utbiuzqjksywjwqnedpl) — costs $10/mo doing nothing
- [ ] Supabase Auth → URL Configuration → set Site URL to the Vercel URL (auth emails currently redirect to localhost:3000)
- [ ] Verify one successful URL capture on a normal (non-bot-walled) site — pipeline works, this is the final checkbox
- [ ] GitHub fine-grained PAT expires ~2026-10-24 — regenerate for future cloud sessions (scope: this repo only, Contents read/write)
- [ ] ANTHROPIC_MODEL on Railway = claude-sonnet-4-5 — bump via Railway variable when a better model ships (no code change)
- [ ] Optional: Vercel project rename or custom domain so the URL says designos

## Feeding the system (not code — the point)

- [ ] Seed the library: 10–15 real saves across loved aesthetics (paste workflow makes this fast)
- [ ] Brand wizard: DIS and Driver with AI prefill from existing sites; paste brand-voice.md rules into the Voice step
- [ ] Approve style profile v1 (three CTA-hierarchy rulings from the 2026-07-27 crit are the starter)
- [ ] RhinoGuard rematch: re-run the prototype with enriched DESIGN.md, compare against the first attempt

## Related projects (decided, not started)

- **Marketing stack manager ("StackOS"?)** — BUILD decision made: category map + costs + renewals + AI-readable stack context. Lightest build (Vercel + Supabase CRUD). No passwords stored, ever — account email + auth method only.
- **Visual bookmarks** — trial Raindrop.io first; if gaps chafe, build as a thin sibling reusing the capture service. Keep generic bookmarks OUT of the DesignOS library (protects the taste signal).

## Decided against (with reasons, so we don't relitigate)

- Rebuilding/forking Impeccable — dependency + DESIGN.md seam instead; fork single commands only if one underperforms
- Password storage anywhere — credential liability; 1Password reference only
- Generic bookmarks inside DesignOS — pollutes what the style profile learns from
- Renaming repo/infra to designos — cosmetic gain, deploy-wiring risk
