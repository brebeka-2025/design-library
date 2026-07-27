# DesignOS

The operating system for Bob's design process — inspiration library, brand guidelines, studio critique, and a learning style profile. (Repo/infra retain the original working name design-library.) Curate inspiration across formats (websites, landing pages, emails, banners), extract structured style data with AI analysis, and generate format-aware, brand-aware briefs and DESIGN.md files for AI-driven design work.

## Architecture

| Piece | Where | What |
|---|---|---|
| `web/` | Vercel | React + Vite + Tailwind frontend |
| `service/` | Railway | Node service: `POST /capture` (Playwright full-page screenshot), `POST /analyze` (Claude vision → draft analysis) |
| `supabase/` | Supabase (`gpsgroedoqkyfspourqe`, us-west-1) | Postgres schema + migrations, `inspiration` storage bucket |

Auth: Supabase email login. The Railway service verifies the user's Supabase JWT on every request. Secrets live only in Railway env vars.

## The review gate

Every ingested item lands as `pending_review`. AI analysis drafts the aesthetic family, keywords, style tokens, designer analysis, image recipe, and brief — nothing enters the approved library until reviewed and approved in the app.

## Railway env vars

| Var | Source |
|---|---|
| `SUPABASE_URL` | set |
| `SUPABASE_ANON_KEY` | set |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API keys |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `ANTHROPIC_MODEL` | set (default `claude-sonnet-4-5`) |

## Local dev

```bash
# frontend
cd web && cp .env.example .env && npm install && npm run dev
# service
cd service && npm install && SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... node src/server.js
```

## Integration seam (Impeccable)

Each library item can export a `DESIGN.md` (tokens + brand constraints + anti-references). Drop it in a project root and Impeccable's commands (`/impeccable polish`, `bolder`, `typeset`, …) execute inside your taste. See the project concept brief for the full model.
