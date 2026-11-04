-- Joint drawing packages. Run after migrations 001-005.
alter table public.pdf_pages add column if not exists level text not null default 'legacy';
alter table public.pdf_pages drop constraint if exists pdf_pages_project_id_page_number_key;
create unique index if not exists pdf_pages_project_level_page_key on public.pdf_pages(project_id,level,page_number);
alter table public.wall_panels drop constraint if exists wall_panels_project_id_wall_id_key;
create unique index if not exists wall_panels_project_level_wall_key on public.wall_panels(project_id,level,wall_id);
alter table public.wall_panels alter column lineal_feet type numeric(14,6);
alter table public.completion_logs alter column lineal_feet type numeric(14,6);
-- The existing own-profile update policy must not let shop users grant themselves supervisor rights.
create function public.protect_profile_assignment() returns trigger
language plpgsql set search_path=public as $$
begin
 if auth.uid() is not null and not public.is_manager() and
    (new.role is distinct from old.role or new.production_line_id is distinct from old.production_line_id) then
  raise exception 'Only supervisors may change roles or production-line assignments';
 end if;
 return new;
end $$;
create trigger profiles_protect_assignment before update on public.profiles
for each row execute function public.protect_profile_assignment();

create table public.bundles (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 level text not null, bundle_id text not null, image_url text not null,
 production_pdf_url text not null, bundle_pdf_url text not null,
 report_feet numeric(14,6) not null check(report_feet>0),
 expected_count int not null check(expected_count>0),
 imported_by uuid not null default auth.uid() references public.profiles(id), imported_at timestamptz not null default now(),
 stacked_at timestamptz, stacked_by uuid references public.profiles(id),
 unique(project_id,level,bundle_id)
);
create table public.bundle_panels (
 id uuid primary key default gen_random_uuid(),
 bundle_id uuid not null references public.bundles(id) on delete cascade,
 wall_panel_id uuid not null references public.wall_panels(id) on delete cascade,
 outline jsonb not null default '[]',
 verified_by uuid references public.profiles(id), verified_at timestamptz,
 unique(wall_panel_id)
);
alter table public.bundles enable row level security;
alter table public.bundle_panels enable row level security;
create policy "read bundles" on public.bundles for select to authenticated using(true);
create policy "read bundle panels" on public.bundle_panels for select to authenticated using(true);
-- Writes are RPC-only: ordinary shop users cannot approve positions or stacking.
create function public.verify_bundle_outline(p_id uuid,p_points jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare pt jsonb; area numeric:=0; prev jsonb;
begin
 if not public.is_manager() then raise exception 'Supervisor required'; end if;
 if jsonb_typeof(p_points)<>'array' or jsonb_array_length(p_points)<3 or jsonb_array_length(p_points)>100 then raise exception 'Draw a panel outline'; end if;
 prev:=p_points->(jsonb_array_length(p_points)-1);
 for pt in select value from jsonb_array_elements(p_points) loop
  if jsonb_typeof(pt->'x') is distinct from 'number' or jsonb_typeof(pt->'y') is distinct from 'number' or not (pt->>'x')::numeric between 0 and 1 or not (pt->>'y')::numeric between 0 and 1 then raise exception 'Invalid point'; end if;
  area:=area+(prev->>'x')::numeric*(pt->>'y')::numeric-(pt->>'x')::numeric*(prev->>'y')::numeric; prev:=pt;
 end loop;
 if abs(area)<0.00001 then raise exception 'Outline has no area'; end if;
 update public.bundle_panels set outline=p_points,verified_by=auth.uid(),verified_at=now() where id=p_id;
 if not found then raise exception 'Panel not found'; end if;
end $$;
create function public.set_bundle_stacked(p_id uuid,p_stacked boolean) returns void
language plpgsql security definer set search_path=public as $$
declare expected int; actual int; complete int;
begin
 if not public.is_manager() then raise exception 'Supervisor required'; end if;
 select expected_count into expected from public.bundles where id=p_id for update;
 -- Lock members so completion/undo cannot race the stacking check.
 perform w.id from public.wall_panels w join public.bundle_panels bp on bp.wall_panel_id=w.id where bp.bundle_id=p_id order by w.id for update of w;
 select count(*),count(*) filter(where w.status='complete') into actual,complete from public.bundle_panels bp join public.wall_panels w on w.id=bp.wall_panel_id where bp.bundle_id=p_id;
 if p_stacked and (expected is null or expected<>actual or complete<>actual) then raise exception 'All expected walls must be production complete before stacking'; end if;
 update public.bundles set stacked_at=case when p_stacked then now() end,stacked_by=case when p_stacked then auth.uid() end where id=p_id;
end $$;
create function public.import_joint_package(p_project uuid,p_level text,p_pages jsonb,p_walls jsonb,p_bundles jsonb,p_accept_differences boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare r jsonb; b jsonb; wid uuid; bid uuid; pageid uuid; actual int; total numeric;
begin
 if not public.is_manager() then raise exception 'Supervisor required'; end if;
 perform id from public.projects where id=p_project for update;
 if not found then raise exception 'Project not found'; end if;
 if exists(select 1 from public.bundles where project_id=p_project and level=p_level) then raise exception 'This level already has a bundle package. Review revisions with a supervisor before replacing it.'; end if;
 if jsonb_array_length(p_walls)=0 or jsonb_array_length(p_bundles)=0 then raise exception 'Empty package'; end if;
 for r in select value from jsonb_array_elements(p_pages) loop
  insert into public.pdf_pages(project_id,level,page_number,image_url) values(p_project,p_level,(r->>'page')::int,r->>'image')
  on conflict(project_id,level,page_number) do update set image_url=excluded.image_url;
 end loop;
 for r in select value from jsonb_array_elements(p_walls) loop
  if (r->>'feet')::numeric<=0 then raise exception 'Invalid wall length'; end if;
  select id into pageid from public.pdf_pages where project_id=p_project and level=p_level and page_number=(r->>'page')::int;
  if pageid is null then raise exception 'Missing wall drawing page'; end if;
  insert into public.wall_panels(project_id,level,wall_id,wall_type,lineal_feet,pdf_page_id,production_line_id,sort_order,bundle_label)
  values(p_project,p_level,r->>'wallId',r->>'wallType',(r->>'feet')::numeric,pageid,(r->>'line')::uuid,(r->>'page')::int*10,r->>'bundleId')
  on conflict(project_id,level,wall_id) do update set wall_type=excluded.wall_type,lineal_feet=excluded.lineal_feet,pdf_page_id=excluded.pdf_page_id,bundle_label=excluded.bundle_label;
 end loop;
 for b in select value from jsonb_array_elements(p_bundles) loop
  insert into public.bundles(project_id,level,bundle_id,image_url,report_feet,expected_count,production_pdf_url,bundle_pdf_url)
  values(p_project,p_level,b->>'id',b->>'image',(b->>'feet')::numeric,(b->>'count')::int,b->>'productionPdfUrl',b->>'bundlePdfUrl') returning id into bid;
  for r in select value from jsonb_array_elements(p_walls) where value->>'bundleId'=b->>'id' loop
   select id into wid from public.wall_panels where project_id=p_project and level=p_level and wall_id=r->>'wallId';
   insert into public.bundle_panels(bundle_id,wall_panel_id) values(bid,wid);
  end loop;
  select count(*),sum(w.lineal_feet) into actual,total from public.bundle_panels bp join public.wall_panels w on w.id=bp.wall_panel_id where bp.bundle_id=bid;
  if actual<>(b->>'count')::int or abs(total-(b->>'feet')::numeric)>(b->>'count')::numeric/192+0.000001 then raise exception 'Bundle reconciliation failed: %', b->>'id'; end if;
  if abs(total-(b->>'feet')::numeric)>0.00001 and not p_accept_differences then raise exception 'Source LF differences require supervisor acceptance'; end if;
 end loop;
 if (select count(*) from public.bundle_panels bp join public.bundles b on b.id=bp.bundle_id where b.project_id=p_project and b.level=p_level)<>jsonb_array_length(p_walls) then raise exception 'Unmatched walls'; end if;
end $$;
revoke all on function public.verify_bundle_outline(uuid,jsonb),public.set_bundle_stacked(uuid,boolean),public.import_joint_package(uuid,text,jsonb,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.verify_bundle_outline(uuid,jsonb),public.set_bundle_stacked(uuid,boolean),public.import_joint_package(uuid,text,jsonb,jsonb,jsonb,boolean) to authenticated;
