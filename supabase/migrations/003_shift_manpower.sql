create table if not exists public.shift_manpower (
  id uuid primary key default gen_random_uuid(),
  production_line_id uuid not null references public.production_lines(id) on delete cascade,
  shift_date date not null default current_date,
  shift_name text not null default 'Day',
  crew_count int not null default 0,
  shift_hours numeric(5,2) not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(production_line_id, shift_date, shift_name)
);

alter table public.shift_manpower enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shift_manpower'
      and policyname = 'read shift manpower'
  ) then
    create policy "read shift manpower"
    on public.shift_manpower
    for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shift_manpower'
      and policyname = 'manager shift manpower insert'
  ) then
    create policy "manager shift manpower insert"
    on public.shift_manpower
    for insert
    to authenticated
    with check (public.is_manager());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shift_manpower'
      and policyname = 'manager shift manpower update'
  ) then
    create policy "manager shift manpower update"
    on public.shift_manpower
    for update
    to authenticated
    using (public.is_manager())
    with check (public.is_manager());
  end if;
end $$;

create trigger shift_manpower_touch_updated_at
before update on public.shift_manpower
for each row execute function public.touch_updated_at();
