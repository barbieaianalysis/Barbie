# Barbie AI — Setup & Deployment Guide

## What's included
- `index.html` — client login (phone + 6-digit PIN, numeric keypad)
- `admin-login.html` — admin-only login
- `dashboard.html` — main app: Hairstyle, Hair Colour, Saree, Chudidar modules (Outfit tab shown as "Coming Soon")
- `admin.html` — admin panel: Gemini cost tracking, user management, all generated looks
- `grid-view.html` — public shareable page for a single generated grid
- `worker.js` — Cloudflare Worker source (deploy separately, see below)
- `manifest.json`, `sw.js`, `_headers`, `_redirects` — PWA + Cloudflare Pages config
- `supabase_schema.sql` — full DB schema for a fresh Supabase project

## 1. Supabase (fresh project)
1. Create a new project at supabase.com.
2. Open the SQL editor and run `supabase_schema.sql` in full.
3. Confirm the `barbie-grid-shares` storage bucket was created and is **public**.
4. Create your first admin user:
   ```sql
   select encode(digest('YOUR_6_DIGIT_PIN', 'sha256'), 'hex');
   -- copy the result, then:
   insert into users (name, phone, pin_hash, role, is_active)
   values ('Your Name', '+91XXXXXXXXXX', '<paste_hash_here>', 'admin', true);
   ```
5. Copy your **Project URL** and **anon public key** from Project Settings → API.

## 2. Cloudflare Worker
1. Go to workers.cloudflare.com → Create a new Worker.
2. Paste in `worker.js`.
3. Worker → Settings → Variables and Secrets → add:
   - `GEMINI_API_KEY` (required)
   - `REMOVEBG_API_KEY` (optional — currently unused by default, see note below)
4. Deploy. Copy the Worker URL, e.g. `https://barbie-ai.yourname.workers.dev`.

**Note on background removal:** unlike Budget Barber, the Barbie prompts explicitly
require the *original* background to be preserved identically across all 16 grid
cells, so `dashboard.html` intentionally does **not** call background removal before
sending to Gemini. The `/removebg` route still exists in `worker.js` for future use
if you want it for a different module.

## 3. Fill in config placeholders
Search each file for these placeholders and replace them:

| Placeholder | File(s) |
|---|---|
| `YOUR_SUPABASE_URL` | `index.html`, `admin-login.html`, `admin.html`, `grid-view.html`, `dashboard.html` |
| `YOUR_SUPABASE_ANON_KEY` | same as above |
| `YOUR_CLOUDFLARE_WORKER_URL` | `dashboard.html` |

## 4. Icons
`manifest.json` and `_headers` reference these files — you'll need to supply them
(they were not generated as part of this build; Budget Barber's icons cannot be
reused since they're a different brand):
- `icon-192.png`, `icon-192-maskable.png`
- `icon-512.png`, `icon-512-maskable.png`
- `apple-touch-icon.png`

## 5. Deploy to Cloudflare Pages
Push this folder to a Git repo (or drag-and-drop deploy) connected to Cloudflare
Pages. No build step needed — it's static HTML. `_redirects` and `_headers` are
picked up automatically.

## 6. Outfit module (pending)
The "Outfit" tab is present in `dashboard.html` but disabled (`.soon` class, no
`tab-outfit` handler wired up). Once you send the general Western/fusion outfit
prompt:
1. Add it to the `PROMPTS` object and a new entry in the `MODULES` array in
   `dashboard.html`'s script.
2. Change the tab's `<div class="tab soon" ...>` to an active tab like the
   other four (`<div class="tab" id="tab-outfit" onclick="switchModule('outfit')">`).
That's the only code change needed — the shared module engine handles the rest.

## Branding
Palette used: deep rose (`#b3536a`), rose-dark (`#7a2e42`), gold accent
(`#c9a66b`), cream background (`#fdf7f3`). Fonts: Playfair Display (headings) +
Poppins (body). Change CSS variables at the top of each file's `<style>` block
to adjust.

## Security notes carried over / fixed from Budget Barber review
- No debug `alert()` of session data (that bug from Budget Barber's
  `admin-login.html` was not carried over).
- API keys (Gemini) live only in the Cloudflare Worker, never in client code.
- Supabase RLS policies in `supabase_schema.sql` are permissive (anon key can
  read/write directly) to match the phone+PIN auth pattern — tighten before
  production if you want stricter guarantees, e.g. by moving writes behind a
  Supabase Edge Function.
