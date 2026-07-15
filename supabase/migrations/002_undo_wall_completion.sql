create or replace function public.undo_wall_completion(p_wall_panel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wall record;
  log_id uuid;
begin
  select * into wall from public.wall_panels where id = p_wall_panel_id for update;
  if wall.id is null then
    raise exception 'Wall panel not found';
  end if;

  if not public.is_manager() and wall.production_line_id <> (select production_line_id from public.profiles where id = auth.uid()) then
    raise exception 'Wall is not assigned to your production line';
  end if;

  if wall.status <> 'complete' then
    return;
  end if;

  select id into log_id
  from public.completion_logs
  where wall_panel_id = p_wall_panel_id
  order by completed_at desc
  limit 1;

  if log_id is not null then
    delete from public.completion_logs where id = log_id;
  end if;

  update public.wall_panels
  set status = 'queued'
  where id = p_wall_panel_id;
end;
$$;
