create table if not exists public.wall_qaqc_checks (
  id uuid primary key default gen_random_uuid(),
  wall_panel_id uuid not null unique references public.wall_panels(id) on delete cascade,
  checklist jsonb not null default '{}'::jsonb,
  checked_by uuid references public.profiles(id),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wall_qaqc_checks_wall_panel_id_idx on public.wall_qaqc_checks(wall_panel_id);
create index if not exists wall_qaqc_checks_checked_at_idx on public.wall_qaqc_checks(checked_at desc);

alter table public.wall_qaqc_checks enable row level security;

create policy "read qaqc checks" on public.wall_qaqc_checks
  for select to authenticated using (true);

create policy "insert qaqc checks" on public.wall_qaqc_checks
  for insert to authenticated
  with check (
    checked_by = auth.uid()
    and exists (
      select 1
      from public.wall_panels wall
      where wall.id = wall_panel_id
        and (
          public.is_manager()
          or wall.production_line_id = (select production_line_id from public.profiles where id = auth.uid())
        )
    )
  );

create policy "update qaqc checks" on public.wall_qaqc_checks
  for update to authenticated
  using (
    public.is_manager()
    or exists (
      select 1
      from public.wall_panels wall
      where wall.id = wall_panel_id
        and wall.production_line_id = (select production_line_id from public.profiles where id = auth.uid())
    )
  )
  with check (checked_by = auth.uid() or public.is_manager());

create trigger wall_qaqc_checks_touch_updated_at
before update on public.wall_qaqc_checks
for each row execute function public.touch_updated_at();
