-- design-library migration 001: initial schema
-- Tables: brands, design_types, aesthetic_families, items, item_usages, style_profiles
-- All tables RLS-enabled, authenticated-only access (single-user app).

-- ============ helper: updated_at trigger ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============ brands ============
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  tokens jsonb not null default '{}'::jsonb,
  voice_rules text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============ design_types ============
create table public.design_types (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  format_profile jsonb not null default '{}'::jsonb,
  sort_order int not null default 0
);

-- ============ aesthetic_families ============
create table public.aesthetic_families (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- ============ items (the library) ============
create table public.items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text,
  captured_at timestamptz not null default now(),
  image_path text,                -- storage path in 'inspiration' bucket
  design_type_id uuid references public.design_types(id),
  aesthetic_family_id uuid references public.aesthetic_families(id),
  brand_id uuid references public.brands(id),
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','archived')),
  bob_note text,                  -- "what I like about this", captured at ingest
  keywords text[] not null default '{}',
  style_tokens jsonb not null default '{}'::jsonb,  -- palette, fonts, spacing, layout, motion
  designer_analysis text,         -- senior graphic designer prose analysis
  image_recipe text,              -- fill-in-[SUBJECT] template for Higgsfield
  brief text,                     -- draft build brief
  analysis_model text,            -- which Claude model produced the draft
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

create index items_status_idx on public.items (status);
create index items_design_type_idx on public.items (design_type_id);
create index items_family_idx on public.items (aesthetic_family_id);

-- ============ item_usages (closing the loop) ============
create table public.item_usages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  project_name text not null,
  outcome_rating int check (outcome_rating between 1 and 5),
  notes text,
  used_at timestamptz not null default now()
);

-- ============ style_profiles (versioned living doc; automation is v2) ============
create table public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  version int not null,
  content text not null,
  status text not null default 'draft'
    check (status in ('draft','approved','superseded')),
  created_at timestamptz not null default now()
);

-- ============ RLS: authenticated-only, full access (single-user app) ============
alter table public.brands enable row level security;
alter table public.design_types enable row level security;
alter table public.aesthetic_families enable row level security;
alter table public.items enable row level security;
alter table public.item_usages enable row level security;
alter table public.style_profiles enable row level security;

create policy "authenticated full access" on public.brands
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.design_types
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.aesthetic_families
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.items
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.item_usages
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.style_profiles
  for all to authenticated using (true) with check (true);

-- ============ storage bucket ============
insert into storage.buckets (id, name, public)
values ('inspiration', 'inspiration', false);

create policy "authenticated read inspiration" on storage.objects
  for select to authenticated using (bucket_id = 'inspiration');
create policy "authenticated write inspiration" on storage.objects
  for insert to authenticated with check (bucket_id = 'inspiration');
create policy "authenticated update inspiration" on storage.objects
  for update to authenticated using (bucket_id = 'inspiration');
create policy "authenticated delete inspiration" on storage.objects
  for delete to authenticated using (bucket_id = 'inspiration');

-- ============ seed: brands ============
insert into public.brands (key, name, notes) values
  ('driver',        'Driver',                 'Product brand. Distinct from DIS (company).'),
  ('dis',           'Driver Industrial Safety','Company. Distinct from Driver (product).'),
  ('core_aviation', 'Core Aviation',           null),
  ('skylofts',      'SkyLofts',                null),
  ('personal',      'Personal / no brand',     'No brand constraints applied.');

-- ============ seed: design types with starter format profiles ============
insert into public.design_types (key, name, format_profile, sort_order) values
  ('landing_page', 'Landing pages', '{"notes":"Single conversion goal. Responsive.","constraints":["mobile-first responsive","single primary CTA","fast LCP: hero image optimized"]}', 1),
  ('website',      'Websites',      '{"notes":"Multi-page. Responsive.","constraints":["mobile-first responsive","consistent nav and footer","accessible contrast AA"]}', 2),
  ('email',        'Emails',        '{"notes":"HTML email constraints are hard constraints.","constraints":["600px max width","table-based layout","system/web-safe font fallbacks for Outlook","dark-mode safe colors","images < 200KB total","all images need alt text","no CSS grid/flex reliance"]}', 3),
  ('banner',       'Banners / ads', '{"notes":"Fixed sizes, weight caps.","constraints":["IAB sizes: 300x250, 728x90, 160x600, 320x50, 970x250","file weight <= 150KB initial load","text legible at actual size","clear CTA within safe area"]}', 4),
  ('social',       'Social graphics','{"notes":"Platform-specific dimensions.","constraints":["target platform dimensions","legible at feed size","safe zones for platform UI overlays"]}', 5),
  ('other',        'Other',         '{}', 99);

-- ============ seed: starter aesthetic families (renameable; emergent over time) ============
insert into public.aesthetic_families (key, name, description) values
  ('print_tech_paper',     'Print-tech paper',     'Warm paper grounds, editorial print DNA, halftone/CMYK textures, mono coordinate labels.'),
  ('vast_quiet_cinematic', 'Vast quiet cinematic', 'Minimal, vertical, monumental imagery, generous negative space, calm pacing.'),
  ('dither_mono',          'Dither mono',          'Dithered 1-bit imagery, monochrome, retro-digital texture.'),
  ('data_as_texture',      'Data as texture',      'Charts, coordinates, and tabular fragments used as surface decoration.'),
  ('classical_remix',      'Classical remix',      'Classical art/architecture collaged with modern type and layout.');
