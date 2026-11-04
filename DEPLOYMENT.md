# Deployment preparation

Target: the existing Teaganmcchesney/The-Mill-Wood-Systems repository, Supabase
project and Vercel application.

## Before promotion

1. Review this branch, including the authentic user-provided round Mill logo,
   its favicon, and Apple/PWA home-screen icons.
2. Confirm the existing Supabase project, Vercel application, signed-in supervisor
   account, and approval for the live migration and promotion. Do not put
   service-role keys or passwords in this repository or chat.
3. Retain existing Vercel values NEXT_PUBLIC_SUPABASE_URL and
   NEXT_PUBLIC_SUPABASE_ANON_KEY. Install using the committed pnpm lockfile and
   run pnpm build. The build script supplies the matching PDF library/worker.
4. Take the normal database backup. Pause drawing imports during the coordinated
   release: migration 006 replaces the old project/page conflict target with
   project/level/page. The old deployed uploader cannot import after that change.
   Existing shop completion and reads are unaffected.
5. Apply only supabase/migrations/006_joint_bundle_packages.sql after the existing
   migrations. Do not replay the initial schema on a live database. Existing
   completion fields and page IDs are preserved.
6. Deploy the reviewed branch to the existing Vercel project, verify its build,
   then promote after the signed-in checks below. Resume imports using the new UI.

## Signed-in checks

- Confirm current projects, drawings, manpower, queue, completion/undo, QA, notes
  and existing Yard records remain available.
- Import both Chinook PDFs under the intended project and L6. Keep the tab open
  during rendering. Expect 361 unique walls, 39 bundles, and 2,430.442708 production
  LF before per-wall storage rounding.
- First bundle B01-611-X1 contains D78, D79, X6, X5, X4, X3, X2 and X1.
  Its printed total is 64 feet 2-9/16 inches; production dimensions sum to 1/16
  inch less. Review every source discrepancy before accepting it.
- Verify all eight first-bundle positions against the drawing. Detected bands may
  need redrawing; suggested positions are never automatically approved.
- Complete one wall and confirm orange fill within 15 seconds. Undo completion:
  fill must clear while other bundle members remain visible.
- Complete all walls: the bundle must say production complete while still
  awaiting stacking. Confirm physical stacking as supervisor and check the
  separate visualization and audit fields.
- Shop users can view progress but cannot approve positions or stack bundles,
  including through direct RPC calls.
- Render a PDF page using the PDF module and worker served from /pdfjs/ on Vercel.

## Rollback

Pause imports and keep the backup available. Reverting the app alone to old main
does not restore its uploader's old database conflict target. Other existing
screens still use the wall/page tables. Do not drop new tables or collapse
level-scoped keys after imports. Plan database rollback against actual data.

## Validation during preparation

- Next.js 14.2.35 production build passed with placeholder build-only Supabase
  values. This does not validate live credentials or production connectivity.
- PDF.js extraction from all 490 production pages and 39 bundle pages passed
  parser reconciliation. Original drawings are not committed to the repository.
- Local PostgreSQL-compatible tests cover rollback, supervisor RPC permissions,
  RLS with authenticated table grants, completion preservation, level isolation
  and stacking gates.
- Live migration, imports, Vercel promotion still need
  service access/approval and final signed-in checks.
