alter table public.production_lines
add column if not exists crew_count int not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'production_lines'
      and policyname = 'manager lines update'
  ) then
    create policy "manager lines update"
    on public.production_lines
    for update
    to authenticated
    using (public.is_manager())
    with check (public.is_manager());
  end if;
end $$;
