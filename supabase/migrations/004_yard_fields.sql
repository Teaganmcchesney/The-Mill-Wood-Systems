alter table public.wall_panels
  add column if not exists yard_status text not null default 'Ready',
  add column if not exists bundle_label text,
  add column if not exists yard_location text,
  add column if not exists yard_notes text;

create index if not exists wall_panels_yard_status_idx on public.wall_panels(status, yard_status);
create index if not exists wall_panels_bundle_label_idx on public.wall_panels(bundle_label);
