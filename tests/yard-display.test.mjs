import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const moduleUrl = (source) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  ).toString("base64");
const parser = moduleUrl(
  readFileSync(new URL("../lib/package-parser.ts", import.meta.url), "utf8"),
);
const source = readFileSync(
  new URL("../lib/yard-display.ts", import.meta.url),
  "utf8",
);
const compiled = ts
  .transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })
  .outputText.replace("'./package-parser'", JSON.stringify(parser))
  .replace('"./package-parser"', JSON.stringify(parser));
const {
  productionComplete,
  hasStoredLayout,
  activeBundle,
  orderedCompleted,
  outlineScene,
} = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const points = [
  { x: 0.1, y: 0.7 },
  { x: 0.8, y: 0.7 },
  { x: 0.8, y: 0.75 },
  { x: 0.1, y: 0.75 },
];
function bundle(name, complete = false) {
  return {
    id: name,
    bundle_id: name,
    project_id: "p",
    projects: { code: "JOB", name: "Job" },
    level: "L6",
    expected_count: 2,
    stacked_at: null,
    bundle_panels: [0, 1].map((i) => ({
      id: name + i,
      outline: points,
      verified_at: "2026-11-04",
      wall_panels: {
        id: name + "-wall-" + i,
        wall_id: "X" + i,
        status: complete ? "complete" : i ? "queued" : "complete",
        sort_order: i,
        production_line_id: "line",
        lineal_feet: 10,
      },
    })),
  };
}
test("active bundle follows the actual queue head, including job identity", () => {
  const one = bundle("B01"),
    two = bundle("B02");
  assert.equal(activeBundle([one, two], { id: "B02-wall-0" }).id, "B02");
  assert.equal(activeBundle([one, two], { id: "unbundled" }), null);
  assert.equal(activeBundle([one, two], null), null);
  assert.equal(activeBundle([bundle("B01", true)], { id: "B01-wall-0" }), null);
});
test("completed labels use bundle-number order and respond to completion/undo", () => {
  const one = bundle("B01"),
    two = bundle("B2", true),
    ten = bundle("B10", true);
  assert.deepEqual(
    orderedCompleted([ten, one, two]).map((b) => b.id),
    ["B2", "B10"],
  );
  one.bundle_panels[1].wall_panels.status = "complete";
  assert.deepEqual(
    orderedCompleted([ten, one, two]).map((b) => b.id),
    ["B01", "B2", "B10"],
  );
  two.bundle_panels[0].wall_panels.status = "queued";
  assert.deepEqual(
    orderedCompleted([ten, one, two]).map((b) => b.id),
    ["B01", "B10"],
  );
});
test("production completion remains separate from physical stacking and requires all members", () => {
  const b = bundle("B01");
  b.stacked_at = "2026-11-04";
  assert.equal(productionComplete(b), false);
  b.bundle_panels[1].wall_panels.status = "complete";
  b.stacked_at = null;
  assert.equal(productionComplete(b), true);
  b.expected_count = 3;
  assert.equal(productionComplete(b), false);
});
test("the worker guide uses stored geometry without approvals and crops out the PDF sheet", () => {
  const b = bundle("B01");
  assert.equal(hasStoredLayout(b), true);
  const scene = outlineScene(b, 792 / 612),
    box = scene.viewBox.split(" ").map(Number);
  assert.ok(box[2] < 1000);
  assert.ok(box[3] < 200);
  assert.equal(scene.walls.length, 2);
  b.bundle_panels[0].verified_at = null;
  assert.equal(hasStoredLayout(b), true);
  b.bundle_panels[0].outline = [];
  assert.equal(hasStoredLayout(b), false);
});
