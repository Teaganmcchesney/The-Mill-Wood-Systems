# PanelTrack Shop PWA

A tablet-first PWA for tracking prefab wall panel completion by production line.

## What is included

- Next.js App Router with TypeScript
- Supabase auth, role-aware profiles, RLS policies, storage buckets, and RPC completion logging
- Admin PDF upload that renders each PDF page into drawing card images in the browser
- Admin create/edit flow for wall panels with wall ID, type, level, area, lineal feet, drawing page, and production line
- Shop queue with large touch targets, drawing previews, swipe-right completion, and a Complete button
- Dashboard with today, week, and remaining lineal feet using Recharts
- PWA manifest and installable app metadata

## Production lines

The default shop setup has two production lines:

- Sheathed
- Interior

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start Supabase locally:

```bash
supabase start
supabase db reset
```

3. Copy environment values:

```bash
cp .env.example .env.local
```

Use the `anon key` printed by `supabase start` for `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

4. Create demo users in Supabase Auth, then add matching profile rows:

```sql
insert into public.profiles (id, full_name, role, production_line_id)
values
  ('<admin-user-id>', 'Admin User', 'admin', null),
  ('<supervisor-user-id>', 'Shift Supervisor', 'supervisor', null),
  ('<shop-user-id>', 'Sheathed Line Operator', 'shop_user', '11111111-1111-1111-1111-111111111111');
```

For quick local testing, create these emails with the password `password123`:

- `admin@example.com`
- `supervisor@example.com`
- `shop1@example.com`

5. Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase notes

Run `supabase/migrations/001_initial_schema.sql` to create:

- roles: `admin`, `supervisor`, `shop_user`
- production lines
- projects
- PDF page cards
- wall panels
- completion logs
- storage buckets: `drawing-packages`, `drawing-pages`
- `complete_wall_panel` RPC used by the shop queue

Run `supabase/seed/seed.sql` after the migration for a sample project, production lines, page cards, and wall panels.

## Shop workflow

1. Admin uploads a PDF drawing package on `/admin`.
2. The browser converts each page to a PNG card and saves it in Supabase Storage.
3. Admin creates wall panel records and assigns each wall to a line.
4. Shop users open `/shop`, pick their line, and complete wall cards by swiping right or pressing Complete.
5. `/dashboard` shows lineal feet completed today, this week, by wall type, by line, and remaining.

## Joint production and bundle packages

Apply migration 006 before using the joint importer. Admin accepts production
drawings and the Complete Bundle Report for one project/level together. Import
checks wall identity, continuation pages, bundle membership counts and production dimensions before
committing the records in one database transaction. Uploads use a unique storage
prefix; failed imports can leave unreferenced files under that prefix.

Production drawings are the only source of wall LF. Bundle reports provide
bundle IDs, panel counts and drawings for membership/completion tracking only.
Their printed footage is never parsed, compared, displayed or used to approve an
import. There is no footage-differences prompt.

Yard automatically traces the current bundle with orange wall outlines and fills
completed walls orange. No outline approval is required. Optional manual shape
adjustments are available in Yard setup. Physical stacking is a separate audited
action, enabled only when every expected wall is complete.
Undoing completion leaves any physical stack record visible with a review message.

Existing production-only imports remain available. Project/level/page and
project/level/wall identities prevent another level from replacing earlier pages
or cards. Already imported joint packages cannot be overwritten through either
uploader; drawing-revision replacement is a separate future task.
The authentic user-supplied MillCo_Circle_Dark.svg now supplies the app icon, favicon, home-screen icons, header and sign-in logo. Original SVG paths are unchanged; raster icons use a white background.

Run pnpm test, pnpm typecheck, and pnpm build. Build scripts copy the installed
PDF.js library and matching worker into public/pdfjs. See DEPLOYMENT.md.


The uploader checks database readiness before reading or uploading either PDF.
Apply migration 006 to the app's existing Supabase project to enable bundle
tracking. The setup is repeatable, preserves existing completions, and notifies
PostgREST to reload its schema. Production-only imports retain the earlier
schema path until bundle setup is complete.

### Yard stacking display

Yard follows the selected production line and job, displaying only the bundle containing the current wall. It automatically traces wall bodies from the Complete Bundle Report and labels them using original production-drawing order. Outline counts and relative widths must match production dimensions; bundle-report footage never enters LF calculations. No outline approval is required. Unsupported layouts show a retry/edit message instead of guessed positions.

Walls fill orange on production completion. Completed bundle names appear at the bottom in bundle-number order and open their outline when selected. Full screen is intended for the second monitor at the end of the line; it refreshes every five seconds. PDFs are not displayed on this screen. Optional shape adjustments and existing physical Yard records are available under `/yard/setup`. Production completion and physical stacking remain separate.
