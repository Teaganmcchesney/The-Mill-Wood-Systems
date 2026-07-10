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
