do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shift_manpower'
      and policyname = 'authenticated shift manpower insert'
  ) then
    create policy "authenticated shift manpower insert"
    on public.shift_manpower
    for insert
    to authenticated
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shift_manpower'
      and policyname = 'authenticated shift manpower update'
  ) then
    create policy "authenticated shift manpower update"
    on public.shift_manpower
    for update
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;
