create table if not exists public.wall_notes (
  id uuid primary key default gen_random_uuid(),
  wall_panel_id uuid not null references public.wall_panels(id) on delete cascade,
  note_text text not null default '',
  markup_data jsonb not null default '{"lines": []}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(wall_panel_id)
);

alter table public.wall_notes enable row level security;

create policy "read wall notes" on public.wall_notes
  for select to authenticated using (true);

create policy "insert wall notes" on public.wall_notes
  for insert to authenticated with check (created_by = auth.uid() or created_by is null or public.is_manager());

create policy "update wall notes" on public.wall_notes
  for update to authenticated using (true) with check (true);

create trigger wall_notes_touch_updated_at
before update on public.wall_notes
for each row execute function public.touch_updated_at();
