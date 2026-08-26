-- ============================================================
-- Barbie AI — Supabase schema
-- Run this in a FRESH Supabase project's SQL editor
-- ============================================================

-- ── Users table (phone + PIN auth, admin/client roles) ───────
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null unique,      -- stored as '+91XXXXXXXXXX'
  pin_hash    text not null,             -- SHA-256 hex of 6-digit PIN
  role        text not null default 'client' check (role in ('admin','client')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_users_phone on users(phone);

-- ── Grid reports (history of generated style grids) ──────────
create table if not exists barbie_grid_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  user_name   text,
  module      text not null check (module in ('hairstyle','haircolour','saree','chudidar','outfit')),
  image_url   text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_reports_user on barbie_grid_reports(user_id);
create index if not exists idx_reports_module on barbie_grid_reports(module);

-- ── Row Level Security ────────────────────────────────────────
-- NOTE: This app authenticates via a custom phone+PIN flow (not Supabase Auth),
-- so RLS policies below allow the anon key to read/write directly.
-- For production, consider moving writes behind a server-side function
-- (e.g. a Supabase Edge Function or the Cloudflare Worker) instead of
-- exposing insert/update to the anon key directly.

alter table users enable row level security;
alter table barbie_grid_reports enable row level security;

-- Users: allow anon key to select (needed for login lookup) and limited update
-- (admin panel toggles is_active; consider tightening this before production).
create policy "users_select_all" on users for select using (true);
create policy "users_insert_all" on users for insert with check (true);
create policy "users_update_all" on users for update using (true);

-- Reports: allow anon key to select/insert (client saves its own reports;
-- admin panel reads all reports).
create policy "reports_select_all" on barbie_grid_reports for select using (true);
create policy "reports_insert_all" on barbie_grid_reports for insert with check (true);

-- ── Storage bucket for shared grid images ─────────────────────
-- Run in Supabase Dashboard → Storage → New bucket:
--   name: barbie-grid-shares
--   public: true
-- Or via SQL (if storage extension is available):
insert into storage.buckets (id, name, public)
values ('barbie-grid-shares', 'barbie-grid-shares', true)
on conflict (id) do nothing;

create policy "grid_shares_public_read" on storage.objects
  for select using (bucket_id = 'barbie-grid-shares');

create policy "grid_shares_anon_upload" on storage.objects
  for insert with check (bucket_id = 'barbie-grid-shares');

-- ── Seed an initial admin user (CHANGE the phone + PIN before running!) ──
-- PIN hash below is a placeholder — generate your own via:
--   SELECT encode(digest('123456', 'sha256'), 'hex');
-- insert into users (name, phone, pin_hash, role, is_active)
-- values ('Admin', '+919999999999', '<sha256_hex_of_your_pin>', 'admin', true);
