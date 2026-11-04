import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
const source = ts.transpileModule(
  readFileSync(new URL("../lib/package-parser.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  },
).outputText;
const {
  imperialFeet,
  parseProduction,
  parseBundles,
  validOutline,
  validatePackageLevels,
} = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
test("exact mixed feet/inches and fractions", () => {
  assert.equal(imperialFeet("11' 11-15/16\""), 11 + 11.9375 / 12);
  assert.equal(imperialFeet("1' 2 1/2\""), 1 + 2.5 / 12);
  assert.equal(imperialFeet('5/16"'), 5 / 192);
  assert.equal(imperialFeet("9' 0\""), 9);
  for (const s of ["bad", '3/0"', "12 mm", ""])
    assert.equal(imperialFeet(s), null);
});
const panel = (id, len = "1' 0\"", bundle = "B01-611-X1") =>
  bundle + " Panel #" + id + " Length: " + len + " Height: 9' 0\"";
test("continuation pages attach once without inflating LF", () => {
  const result = parseProduction([
    panel("D78"),
    "B01-611-X1 Exterior Sheathing: Start: Flush",
    panel("D79"),
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].pages, [1, 2]);
  assert.equal(result[0].sheathed, true);
  assert.throws(
    () => parseProduction([panel("D78"), panel("D78")]),
    /Duplicate/,
  );
});
test("bundle ID/count and length checks", () => {
  const walls = parseProduction([panel("D78"), panel("D79")]);
  assert.equal(
    parseBundles(
      ["B01-611-X1 Total: 2' 0\" Sheathed (0): Unsheathed (2):"],
      walls,
    ).length,
    1,
  );
  assert.throws(
    () => parseBundles(["B01-611-X1 Total: 3' 0\" Unsheathed (2):"], walls),
    /Resolve/,
  );
  assert.throws(
    () => parseBundles(["B02-611-X1 Total: 2' 0\" Unsheathed (2):"], walls),
    /Resolve/,
  );
  assert.throws(
    () => parseBundles(["B01-611-X1 Total: 2' 0\" Unsheathed (3):"], walls),
    /Resolve/,
  );
});
test("outline requires bounded nonzero geometry", () => {
  assert.equal(
    validOutline([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
    true,
  );
  assert.equal(
    validOutline([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]),
    false,
  );
  assert.equal(
    validOutline([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
    ]),
    false,
  );
});
if (process.env.CHINOOK_REVIEW) {
  test("all 490 production pages reconcile with all 39 real bundle reports", () => {
    const dir = process.env.CHINOOK_REVIEW;
    const walls = parseProduction(
      JSON.parse(readFileSync(dir + "/production.json")),
    );
    const bundles = parseBundles(
      JSON.parse(readFileSync(dir + "/bundles.json")),
      walls,
    );
    assert.equal(walls.length, 361);
    assert.equal(bundles.length, 39);
    assert.equal(bundles[0].members.length, 8);
    assert.ok(
      Math.abs(walls.reduce((s, p) => s + p.feet, 0) - 2430.442708333333) <
        0.000001,
    );
  });
}

test("source levels agree with each other and selected level", () => {
  validatePackageLevels(["LEVEL 6"], ["LEVEL 6,NOTES"], "L6");
  assert.throws(
    () => validatePackageLevels(["LEVEL 6"], ["LEVEL 6"], "L1"),
    /Select L6/,
  );
  assert.throws(
    () => validatePackageLevels(["LEVEL 6"], ["LEVEL 5"], "L6"),
    /different levels/,
  );
});
