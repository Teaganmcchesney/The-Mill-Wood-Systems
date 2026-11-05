import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const code = ts.transpileModule(
  readFileSync(new URL("../lib/production-queue.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022 } },
).outputText;
const { sortProductionWalls } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const id = (n) => "00000000-0000-0000-0000-" + String(n).padStart(12, "0");
test("B6 moves as a whole ahead of B1 on both lines; immutable bottom-to-top order, undo, and security", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user',true),'')::uuid$$;
 create function public.is_manager() returns boolean language sql stable as $$select auth.uid()='${id(100)}'::uuid$$;
 grant usage on schema auth to authenticated;
 create table bundles(id uuid primary key,bundle_id text,imported_at timestamptz default now(),stacked_at timestamptz);
 create table wall_panels(id uuid primary key,sort_order int,status text,production_line_id uuid,page int);
 create table bundle_panels(bundle_id uuid references bundles(id),wall_panel_id uuid references wall_panels(id));
 alter table bundles enable row level security;
 create policy read_bundles on bundles for select to authenticated using(true);
 grant select on bundles,bundle_panels,wall_panels to authenticated;
 insert into bundles(id,bundle_id) values('${id(1)}','B1'),('${id(2)}','B2'),('${id(6)}','B6');
 insert into wall_panels values('${id(11)}',10,'queued','${id(9001)}',1),('${id(12)}',20,'queued','${id(9001)}',2),('${id(21)}',30,'queued','${id(9002)}',3),('${id(60)}',600,'queued','${id(9001)}',60),('${id(61)}',610,'queued','${id(9002)}',61),('${id(62)}',620,'queued','${id(9001)}',62),('${id(99)}',25,'queued','${id(9001)}',99);
 insert into bundle_panels values('${id(1)}','${id(11)}'),('${id(1)}','${id(12)}'),('${id(2)}','${id(21)}'),('${id(6)}','${id(60)}'),('${id(6)}','${id(61)}'),('${id(6)}','${id(62)}');`);
    await db.exec(`create table pdf_pages(id uuid primary key,page_number int);
 alter table wall_panels add column pdf_page_id uuid;
 alter table wall_panels add column project_id uuid default '${id(200)}';
 insert into pdf_pages select id,page from wall_panels;
 update wall_panels set pdf_page_id=id;
 grant select on pdf_pages to authenticated;`);
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261105183838_bundle_production_order.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const snapshot = (await db.query("select * from wall_panels order by id"))
      .rows;
    await db.exec(
      `select set_config('app.user','${id(100)}',false);set role authenticated;`,
    );
    await db.query("select move_production_bundle($1,$2)", [id(6), id(1)]);
    const readQueue = async () => {
      const rows = (
        await db.query(
          "select w.*,b.id bid,b.bundle_id,b.production_order from wall_panels w left join bundle_panels bp on bp.wall_panel_id=w.id left join bundles b on b.id=bp.bundle_id",
        )
      ).rows;
      return sortProductionWalls(
        rows
          .filter((w) => w.status !== "complete")
          .map((w) => ({
            ...w,
            pdf_pages: { page_number: w.page },
            bundle_panels: w.bid
              ? [
                  {
                    bundles: {
                      id: w.bid,
                      bundle_id: w.bundle_id,
                      production_order: w.production_order,
                    },
                  },
                ]
              : [],
          })),
      );
    };
    assert.equal(
      (
        await db.query("select page from production_queue($1,null) limit 1", [
          id(9001),
        ])
      ).rows[0].page,
      60,
    );
    assert.equal(
      (
        await db.query("select page from production_queue($1,null) limit 1", [
          id(9002),
        ])
      ).rows[0].page,
      61,
    );
    assert.equal(
      (
        await db.query("select count(*)::int n from production_queue($1,$2)", [
          id(9001),
          id(201),
        ])
      ).rows[0].n,
      0,
    );
    let queue = await readQueue();
    assert.deepEqual(
      queue.filter((w) => w.production_line_id === id(9001)).map((w) => w.page),
      [60, 62, 99, 1, 2],
    );
    assert.deepEqual(
      queue.filter((w) => w.production_line_id === id(9002)).map((w) => w.page),
      [61, 3],
    );
    // No completion, physical stack, LF, or wall sort fields are changed to schedule a bundle.
    assert.deepEqual(
      (await db.query("select * from wall_panels order by id")).rows,
      snapshot,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from bundles where stacked_at is not null",
        )
      ).rows[0].n,
      0,
    );
    const before = (
      await db.query("select id,production_order from bundles order by id")
    ).rows;
    await assert.rejects(
      db.query("select move_production_bundle($1,$2)", [id(6), id(777)]),
      /destination bundle changed/i,
    );
    assert.deepEqual(
      (await db.query("select id,production_order from bundles order by id"))
        .rows,
      before,
    );
    await assert.rejects(
      db.query("update bundles set stacked_at=now() where id=$1", [id(6)]),
      /permission denied/i,
    );
    await db.exec(
      `reset role;update wall_panels set status='complete' where id='${id(60)}';set role authenticated;`,
    );
    queue = await readQueue();
    assert.equal(
      queue.filter((w) => w.production_line_id === id(9001))[0].page,
      62,
    );
    await db.exec(
      `reset role;update wall_panels set status='queued' where id='${id(60)}';set role authenticated;`,
    );
    queue = await readQueue();
    assert.equal(
      queue.filter((w) => w.production_line_id === id(9001))[0].page,
      60,
    );
    await db.query("select move_production_bundle($1,null)", [id(6)]);
    queue = await readQueue();
    assert.deepEqual(
      queue.filter((w) => w.bid === id(6)).map((w) => w.page),
      [60, 61, 62],
    );
    await db.exec(
      `reset role;insert into bundles(id,bundle_id) values('${id(7)}','B7');`,
    );
    assert.equal(
      (
        await db.query(
          "select bundle_id from bundles order by production_order desc limit 1",
        )
      ).rows[0].bundle_id,
      "B7",
    );
    await db.exec(
      `select set_config('app.user','${id(101)}',false);set role authenticated;`,
    );
    await assert.rejects(
      db.query("select move_production_bundle($1,$2)", [id(6), id(1)]),
      /supervisor required/i,
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      db.query("select move_production_bundle($1,$2)", [id(6), id(1)]),
      /permission denied/i,
    );
  } finally {
    await db.close();
  }
});
test("wall order uses source pages even when old per-wall priority is reversed, including joined data shapes", () => {
  const bundle = { id: "B6", bundle_id: "B6", production_order: 1 };
  const walls = [
    {
      id: "top",
      sort_order: 1,
      pdf_pages: [{ page_number: 62 }],
      bundle_panels: [{ bundles: [bundle] }],
    },
    {
      id: "bottom",
      sort_order: 999,
      pdf_pages: { page_number: 60 },
      bundle_panels: { bundles: bundle },
    },
  ];
  assert.deepEqual(
    sortProductionWalls(walls).map((w) => w.id),
    ["bottom", "top"],
  );
  assert.deepEqual(
    sortProductionWalls([
      { id: "legacy2", sort_order: 20 },
      { id: "legacy1", sort_order: 10 },
    ]).map((w) => w.id),
    ["legacy1", "legacy2"],
  );
});
