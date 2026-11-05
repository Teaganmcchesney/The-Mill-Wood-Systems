begin;
-- Bundle priority is independent of wall order, completion and physical stacking.
alter table public.bundles add column production_order bigint;
with initial as (
 select b.id,coalesce(min(w.sort_order),0)::bigint*100000
  + row_number() over(order by b.imported_at,b.bundle_id,b.id) as position
 from public.bundles b left join public.bundle_panels bp on bp.bundle_id=b.id
 left join public.wall_panels w on w.id=bp.wall_panel_id group by b.id
)
update public.bundles b set production_order=i.position from initial i where i.id=b.id;
alter table public.bundles alter column production_order set not null;
alter table public.bundles add constraint bundles_production_order_unique
 unique(production_order) deferrable initially deferred;

create function public.append_production_bundle() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(72751601);
 -- Every future import appends to the plan, including imports from older app versions.
 select coalesce(max(b.production_order),0)+100000 into new.production_order from public.bundles b;
 return new;
end $$;
create trigger bundles_append_production_order before insert on public.bundles
for each row execute function public.append_production_bundle();
revoke all on function public.append_production_bundle() from public,anon,authenticated;

-- Column-scoped writes and RLS retain the existing supervisor/admin scheduling role.
grant update(production_order) on public.bundles to authenticated;
create policy "managers schedule bundles" on public.bundles for update to authenticated
 using(public.is_manager()) with check(public.is_manager());

create function public.move_production_bundle(p_bundle uuid,p_before uuid default null) returns void
language plpgsql security invoker set search_path='' as $$
declare ids uuid[]; slots bigint[]; remaining uuid[]; ordered uuid[]; target int;
begin
 if auth.uid() is null or not public.is_manager() then raise exception 'Supervisor required to change the production plan'; end if;
 perform pg_catalog.pg_advisory_xact_lock(72751601);
 perform b.id from public.bundles b order by b.id for update;
 if not exists(select 1 from public.bundle_panels bp join public.wall_panels w on w.id=bp.wall_panel_id where bp.bundle_id=p_bundle and w.status<>'complete') then
  raise exception 'This bundle has no remaining walls. Refresh the plan.';
 end if;
 if p_before=p_bundle then return; end if;
 if p_before is not null and not exists(select 1 from public.bundle_panels bp join public.wall_panels w on w.id=bp.wall_panel_id where bp.bundle_id=p_before and w.status<>'complete') then
  raise exception 'The destination bundle changed. Refresh the plan.';
 end if;
 select array_agg(b.id order by b.production_order,b.id),array_agg(b.production_order order by b.production_order,b.id)
 into ids,slots from public.bundles b;
 remaining:=array_remove(ids,p_bundle);
 if p_before is null then ordered:=remaining||array[p_bundle];
 else
  target:=array_position(remaining,p_before);
  ordered:=coalesce(remaining[1:target-1],'{}'::uuid[])||array[p_bundle]||coalesce(remaining[target:array_length(remaining,1)],'{}'::uuid[]);
 end if;
 -- Reuse existing priority slots: unrelated legacy wall positions stay unchanged.
 update public.bundles b set production_order=slots[q.n]
 from unnest(ordered) with ordinality q(id,n) where b.id=q.id and b.production_order is distinct from slots[q.n];
end $$;
revoke all on function public.move_production_bundle(uuid,uuid) from public,anon;
grant execute on function public.move_production_bundle(uuid,uuid) to authenticated;
-- Sort before PostgREST's response limit so a newly promoted bundle is never hidden
-- behind the first page of an older per-wall queue.
create function public.production_queue(p_line uuid,p_project uuid default null)
returns setof public.wall_panels language sql stable security invoker set search_path='' as $$
 select w.* from public.wall_panels w
 left join public.bundle_panels bp on bp.wall_panel_id=w.id
 left join public.bundles b on b.id=bp.bundle_id
 left join public.pdf_pages p on p.id=w.pdf_page_id
 where w.production_line_id=p_line and w.status<>'complete'
  and (p_project is null or w.project_id=p_project)
 order by coalesce(b.production_order,w.sort_order::bigint*100000),
  coalesce(b.id,w.id),coalesce(p.page_number,w.sort_order),w.id
$$;
revoke all on function public.production_queue(uuid,uuid) from public,anon;
grant execute on function public.production_queue(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
