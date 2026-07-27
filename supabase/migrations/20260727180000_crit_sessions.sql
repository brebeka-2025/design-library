-- DesignOS migration 002: The Crit — collaborative critique sessions
-- crit_sessions: one row per studio crit (image under review, brand context, intent)
-- crit_messages: the conversation thread

create table public.crit_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_path text not null,              -- storage path in 'inspiration' bucket (crits/... or reuse of item image)
  item_id uuid references public.items(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  intent text,                           -- what the design is for; anchors the crit
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table public.crit_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.crit_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index crit_messages_session_idx on public.crit_messages (session_id, created_at);

alter table public.crit_sessions enable row level security;
alter table public.crit_messages enable row level security;

create policy "authenticated full access" on public.crit_sessions
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.crit_messages
  for all to authenticated using (true) with check (true);
