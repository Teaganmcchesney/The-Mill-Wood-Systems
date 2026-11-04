import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

test("joint package migration, rollback, level isolation, permissions and stacking", async () => {
  const db = new PGlite();
  const manager = "10000000-0000-0000-0000-000000000001",
    shop = "10000000-0000-0000-0000-000000000002";
  const project = "20000000-0000-0000-0000-000000000001",
    line = "30000000-0000-0000-0000-000000000001";
  try {
    await db.exec(`
 create role anon; create role authenticated;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user',true),'')::uuid $$;
 create table profiles(id uuid primary key,role text not null,production_line_id uuid);
 create table completion_logs(id uuid primary key,lineal_feet numeric(10,2));
 create function public.is_manager() returns boolean language sql stable as $$ select coalesce((select role in ('admin','supervisor') from profiles where id=auth.uid()),false) $$;
 create table projects(id uuid primary key);
 create table production_lines(id uuid primary key);
 create table pdf_pages(id uuid primary key default gen_random_uuid(),project_id uuid references projects(id),page_number int,image_url text,unique(project_id,page_number));
 create table wall_panels(id uuid primary key default gen_random_uuid(),project_id uuid references projects(id),wall_id text,wall_type text,level text,area_sqft numeric default 0,lineal_feet numeric(10,2),pdf_page_id uuid references pdf_pages(id),production_line_id uuid references production_lines(id),sort_order int,bundle_label text,status text not null default 'queued',unique(project_id,wall_id));
 grant usage on schema auth to authenticated;
 grant select on profiles to authenticated;
 grant select on wall_panels to authenticated;
 insert into profiles(id,role) values ('${manager}','supervisor'),('${shop}','shop_user');
 insert into projects values ('${project}');
 insert into production_lines values ('${line}');
 `);
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/006_joint_bundle_packages.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("select set_config('app.user',$1,false)", [manager]);
    // Re-run over the previous schema: an obsolete non-null report field and six-argument RPC
    // must not force bundle-report LF back into imports.
    await db.exec(
      "alter table bundles add column report_feet numeric not null",
    );
    await db.exec(
      "create function import_joint_package(uuid,text,jsonb,jsonb,jsonb,boolean default false) returns void language plpgsql as $$ begin return; end $$",
    );
    const migration = readFileSync(
      new URL(
        "../supabase/migrations/006_joint_bundle_packages.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    assert.equal(
      (await db.query("select bundle_import_ready() ready")).rows[0].ready,
      true,
    );
    assert.equal(
      (
        await db.query(
          "select to_regprocedure('import_joint_package(uuid,text,jsonb,jsonb,jsonb,boolean)') old",
        )
      ).rows[0].old,
      null,
    );

    const walls = [
      {
        wallId: "D78",
        bundleId: "B01-611-X1",
        wallType: "Interior",
        feet: 1,
        page: 1,
        line,
      },
      {
        wallId: "D79",
        bundleId: "B01-611-X1",
        wallType: "Interior",
        feet: 1,
        page: 2,
        line,
      },
    ];
    const pages = [
      { page: 1, image: "https://example.test/p1.jpg" },
      { page: 2, image: "https://example.test/p2.jpg" },
    ];
    const bundles = [
      {
        id: "B01-611-X1",
        feet: "not a wall length",
        count: 2,
        image: "https://example.test/b.jpg",
        productionPdfUrl: "https://example.test/p.pdf",
        bundlePdfUrl: "https://example.test/b.pdf",
      },
    ];
    // An existing completion must remain complete when attaching the joint package.
    await db.query(
      "insert into wall_panels(project_id,wall_id,wall_type,level,lineal_feet,production_line_id,status) values($1,'D78','Interior','L6',1,$2,'complete')",
      [project, line],
    );
    const importPackage = (level = "L6", rows = walls, bs = bundles) =>
      db.query("select import_joint_package($1,$2,$3,$4,$5)", [
        project,
        level,
        JSON.stringify(pages),
        JSON.stringify(rows),
        JSON.stringify(bs),
      ]);
    await assert.rejects(
      importPackage("L6", walls, [{ ...bundles[0], count: 3 }]),
      /membership count/,
    );
    assert.equal(
      (await db.query("select count(*)::int n from pdf_pages")).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("select count(*)::int n from bundles")).rows[0].n,
      0,
    );
    await importPackage();
    assert.equal(
      (await db.query("select status from wall_panels where wall_id='D78'"))
        .rows[0].status,
      "complete",
    );
    assert.equal(
      Number(
        (await db.query("select sum(lineal_feet) total from wall_panels"))
          .rows[0].total,
      ),
      2,
    );
    assert.equal(
      (await db.query("select report_feet from bundles")).rows[0].report_feet,
      null,
    );
    const bundle = (await db.query("select id from bundles")).rows[0].id;
    const panel = (await db.query("select id from bundle_panels limit 1"))
      .rows[0].id;
    await assert.rejects(importPackage(), /already has/);
    await assert.rejects(
      db.query("select set_bundle_stacked($1,true)", [bundle]),
      /production complete/,
    );
    await assert.rejects(
      db.query("select verify_bundle_outline($1,$2)", [
        panel,
        JSON.stringify([{}, {}, {}]),
      ]),
      /Invalid point/,
    );
    await assert.rejects(
      db.query("select verify_bundle_outline($1,$2)", [
        panel,
        JSON.stringify([
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ]),
      ]),
      /no area/,
    );
    await db.exec(
      "grant select,insert,update,delete on bundles,bundle_panels to authenticated",
    );
    await db.exec("grant update on profiles to authenticated");
    await db.exec("set role authenticated");
    await db.query("select set_config('app.user',$1,false)", [shop]);
    await assert.rejects(
      db.query("update profiles set role='supervisor' where id=$1", [shop]),
      /Only supervisors/,
    );
    const outline = JSON.stringify([
      { x: 0.1, y: 0.7 },
      { x: 0.6, y: 0.7 },
      { x: 0.6, y: 0.73 },
      { x: 0.1, y: 0.73 },
    ]);
    await assert.rejects(
      db.query("select verify_bundle_outline($1,$2)", [panel, outline]),
      /Supervisor/,
    );
    await assert.rejects(
      db.query("select set_bundle_stacked($1,true)", [bundle]),
      /Supervisor/,
    );
    await assert.rejects(importPackage("L5"), /Supervisor/);
    assert.equal(
      (await db.query("update bundles set stacked_at=now() returning id")).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update bundle_panels set verified_at=now() returning id",
        )
      ).rows.length,
      0,
    );
    await db.query("select set_config('app.user',$1,false)", [manager]);
    await db.query("select verify_bundle_outline($1,$2)", [panel, outline]);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query("select verified_by from bundle_panels where id=$1", [
          panel,
        ])
      ).rows[0].verified_by,
      manager,
    );
    await db.exec("update wall_panels set status='complete'");
    await db.query("select set_bundle_stacked($1,true)", [bundle]);
    assert.ok(
      (await db.query("select stacked_at from bundles where id=$1", [bundle]))
        .rows[0].stacked_at,
    );
    await db.query("select set_bundle_stacked($1,false)", [bundle]);
    assert.equal(
      (await db.query("select stacked_at from bundles where id=$1", [bundle]))
        .rows[0].stacked_at,
      null,
    );
    await importPackage("L5");
    assert.equal(
      (await db.query("select count(*)::int n from wall_panels")).rows[0].n,
      4,
    );
    assert.equal(
      (await db.query("select count(*)::int n from pdf_pages")).rows[0].n,
      4,
    );
    await assert.rejects(
      importPackage("L4", walls, [{ ...bundles[0], count: 3 }]),
      /membership count/,
    );
    assert.equal(
      (await db.query("select count(*)::int n from pdf_pages where level='L4'"))
        .rows[0].n,
      0,
    );

    if (process.env.CHINOOK_REVIEW) {
      const source = ts.transpileModule(
        readFileSync(
          new URL("../lib/package-parser.ts", import.meta.url),
          "utf8",
        ),
        {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
          },
        },
      ).outputText;
      const { parseProduction, parseBundles } = await import(
        "data:text/javascript;base64," + Buffer.from(source).toString("base64")
      );
      const dir = process.env.CHINOOK_REVIEW;
      const fullWalls = parseProduction(
        JSON.parse(readFileSync(dir + "/production.json")),
      );
      const fullBundles = parseBundles(
        JSON.parse(readFileSync(dir + "/bundles.json")),
        fullWalls,
      );
      await db.query("select import_joint_package($1,$2,$3,$4,$5)", [
        project,
        "CHINOOK",
        JSON.stringify(
          Array.from({ length: 490 }, (_, i) => ({
            page: i + 1,
            image: "https://example.test/p" + i + ".jpg",
          })),
        ),
        JSON.stringify(
          fullWalls.map((p) => ({
            ...p,
            wallType: p.sheathed ? "Sheathed" : "Interior",
            line,
          })),
        ),
        JSON.stringify(
          fullBundles.map((b) => ({
            ...b,
            image: "https://example.test/b.jpg",
            productionPdfUrl: "https://example.test/p.pdf",
            bundlePdfUrl: "https://example.test/b.pdf",
          })),
        ),
      ]);
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from wall_panels where level='CHINOOK'",
          )
        ).rows[0].n,
        361,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from bundles where level='CHINOOK'",
          )
        ).rows[0].n,
        39,
      );
    }
  } finally {
    await db.close();
  }
});
