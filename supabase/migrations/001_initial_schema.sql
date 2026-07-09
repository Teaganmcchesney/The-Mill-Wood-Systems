create extension if not exists "pgcrypto";

create type app_role as enum ('admin', 'supervisor', 'shop_user');
create type wall_status as enum ('queued', 'in_progress', 'complete');

create table public.production_lines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role app_role not null default 'shop_user',
  production_line_id uuid references public.production_lines(id),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  drawing_pdf_url text,
  created_at timestamptz not null default now()
);

create table public.pdf_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  page_number int not null,
  image_url text not null,
  created_at timestamptz not null default now(),
  unique(project_id, page_number)
);

create table public.wall_panels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  wall_id text not null,
  wall_type text not null,
  level text not null,
  area_sqft numeric(10,2) not null default 0,
  lineal_feet numeric(10,2) not null default 0,
  pdf_page_id uuid references public.pdf_pages(id) on delete set null,
  production_line_id uuid not null references public.production_lines(id),
  status wall_status not null default 'queued',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, wall_id)
);

create table public.completion_logs (
  id uuid primary key default gen_random_uuid(),
  wall_panel_id uuid not null references public.wall_panels(id) on delete cascade,
  wall_id text not null,
  wall_type text not null,
  lineal_feet numeric(10,2) not null,
  production_line_id uuid not null references public.production_lines(id),
  completed_by uuid not null references public.profiles(id),
  completed_at timestamptz not null default now()
);

create index completion_logs_completed_at_idx on public.completion_logs(completed_at desc);
create index wall_panels_line_status_idx on public.wall_panels(production_line_id, status, sort_order);

alter table public.production_lines enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.pdf_pages enable row level security;
alter table public.wall_panels enable row level security;
alter table public.completion_logs enable row level security;

create or replace function public.current_role()
returns app_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_role() in ('admin', 'supervisor'), false)
$$;

create policy "read lines" on public.production_lines for select to authenticated using (true);
create policy "read profiles" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "manager profile update" on public.profiles for update to authenticated using (public.is_manager());

create policy "read projects" on public.projects for select to authenticated using (true);
create policy "manager projects insert" on public.projects for insert to authenticated with check (public.is_manager());
create policy "manager projects update" on public.projects for update to authenticated using (public.is_manager());

create policy "read pdf pages" on public.pdf_pages for select to authenticated using (true);
create policy "manager pdf pages insert" on public.pdf_pages for insert to authenticated with check (public.is_manager());
create policy "manager pdf pages update" on public.pdf_pages for update to authenticated using (public.is_manager());

create policy "read walls" on public.wall_panels for select to authenticated using (true);
create policy "manager walls insert" on public.wall_panels for insert to authenticated with check (public.is_manager());
create policy "manager walls update" on public.wall_panels for update to authenticated using (public.is_manager());
create policy "shop can mark assigned walls" on public.wall_panels
  for update to authenticated
  using (
    production_line_id = (select production_line_id from public.profiles where id = auth.uid())
    or public.is_manager()
  );

create policy "read completions" on public.completion_logs for select to authenticated using (true);
create policy "insert own completions" on public.completion_logs for insert to authenticated with check (completed_by = auth.uid() or public.is_manager());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger wall_panels_touch_updated_at
before update on public.wall_panels
for each row execute function public.touch_updated_at();

create or replace function public.complete_wall_panel(p_wall_panel_id uuid, p_completed_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wall record;
begin
  select * into wall from public.wall_panels where id = p_wall_panel_id for update;
  if wall.id is null then
    raise exception 'Wall panel not found';
  end if;

  if p_completed_by <> auth.uid() then
    raise exception 'Completion user must match the signed-in user';
  end if;

  if wall.status = 'complete' then
    return;
  end if;

  if not public.is_manager() and wall.production_line_id <> (select production_line_id from public.profiles where id = auth.uid()) then
    raise exception 'Wall is not assigned to your production line';
  end if;

  update public.wall_panels
  set status = 'complete'
  where id = p_wall_panel_id;

  insert into public.completion_logs (
    wall_panel_id,
    wall_id,
    wall_type,
    lineal_feet,
    production_line_id,
    completed_by
  )
  values (
    wall.id,
    wall.wall_id,
    wall.wall_type,
    wall.lineal_feet,
    wall.production_line_id,
    p_completed_by
  );
end;
$$;

insert into storage.buckets (id, name, public)
values ('drawing-packages', 'drawing-packages', true), ('drawing-pages', 'drawing-pages', true)
on conflict (id) do nothing;

create policy "authenticated drawing package uploads" on storage.objects
  for insert to authenticated with check (bucket_id in ('drawing-packages', 'drawing-pages'));
create policy "authenticated drawing package updates" on storage.objects
  for update to authenticated using (bucket_id in ('drawing-packages', 'drawing-pages'));
create policy "public drawing reads" on storage.objects
  for select using (bucket_id in ('drawing-packages', 'drawing-pages'));
