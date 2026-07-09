insert into public.production_lines (id, name, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'Line 1', 10),
  ('22222222-2222-2222-2222-222222222222', 'Line 2', 20),
  ('33333333-3333-3333-3333-333333333333', 'Shear Wall Line', 30)
on conflict (id) do nothing;

insert into public.projects (id, code, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P-2407', 'Cedar Ridge Townhomes')
on conflict (id) do nothing;

insert into public.pdf_pages (id, project_id, page_number, image_url) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'https://placehold.co/680x880/f8fafc/14213d?text=Wall+Drawing+Page+1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 'https://placehold.co/680x880/f8fafc/14213d?text=Wall+Drawing+Page+2')
on conflict (project_id, page_number) do nothing;

insert into public.wall_panels (
  project_id,
  wall_id,
  wall_type,
  level,
  area_sqft,
  lineal_feet,
  pdf_page_id,
  production_line_id,
  status,
  sort_order
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A101', 'Exterior', 'L1', 284, 22.5, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', '11111111-1111-1111-1111-111111111111', 'queued', 10),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A102', 'Exterior', 'L1', 312, 24.0, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', '11111111-1111-1111-1111-111111111111', 'queued', 20),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B201', 'Interior', 'L2', 198, 18.5, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', '22222222-2222-2222-2222-222222222222', 'queued', 10),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'S301', 'Shear', 'L3', 226, 20.0, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', '33333333-3333-3333-3333-333333333333', 'queued', 10)
on conflict (project_id, wall_id) do nothing;
