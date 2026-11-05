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
  bundleId,
  productionHeightFeet,
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
test("bundle reports supply membership only; report footage is ignored", () => {
  const walls = parseProduction([panel("D78"), panel("D79")]);
  for (const report of [
    "B01-611-X1 Unsheathed (2):",
    "B01-611-X1 Total: 99999' 11-15/16\" Unsheathed (2):",
    "B01-611-X1 Total: not a dimension Unsheathed (2):",
  ]) {
    const result = parseBundles([report], walls);
    assert.equal(result.length, 1);
    assert.equal(result[0].count, 2);
    assert.deepEqual(
      result[0].members.map((p) => p.wallId),
      ["D78", "D79"],
    );
    assert.equal("feet" in result[0], false);
    assert.equal(
      walls.reduce((s, p) => s + p.feet, 0),
      2,
    );
  }
  assert.throws(
    () => parseBundles(["B02-611-X1 Unsheathed (2):"], walls),
    /membership/,
  );
  assert.throws(
    () => parseBundles(["B01-611-X1 Unsheathed (3):"], walls),
    /membership/,
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

test("Rohit level-coded bundle IDs work alongside Chinook IDs without truncating unsupported IDs", () => {
  assert.equal(bundleId("Panel Production B01-L1-D1 Level 1"), "B01-L1-D1");
  assert.equal(bundleId("Bundling b18-l1-x4 Level 1"), "B18-L1-X4");
  assert.equal(bundleId("B01-611-X1 Level 6"), "B01-611-X1");
  for (const bad of ["B01-LX-D1", "B01-L1-D1-OTHER", "B01-L1-D1_EXTRA"])
    assert.equal(bundleId(bad), null);
  const raw =
    'B01-L1-D1 Level 1 Panel #D33 Length: 11\' 1-5/8" Height: 9\' 1-1/8" First Stud Face @3-1/2"';
  const walls = parseProduction([raw]);
  assert.equal(walls[0].bundleId, "B01-L1-D1");
  assert.equal(walls[0].wallId, "D33");
  assert.equal(walls[0].feet, 11 + 1.625 / 12);
  assert.equal(
    parseBundles(["B01-L1-D1 Unsheathed (1): Total: not footage"], walls)[0]
      .count,
    1,
  );
});
test("import errors identify the unreadable field and page separately", () => {
  assert.throws(
    () => parseProduction([panel("D33", "1' 0\"", "B01-LX-D1")]),
    /bundle ID.*D33.*page 1/,
  );
  assert.throws(
    () => parseProduction([panel("D33", "bad", "B01-L1-D1")]),
    /positive Length.*D33.*page 1/,
  );
});
test("rotated panel cross-section dimensions are separate from production LF", () => {
  const text =
    'B04-L1-X3 Panel #P273 Length: 3\' 7" Height: 11-7/8" First Stud Face @3-1/2"';
  assert.equal(productionHeightFeet(text), 11.875 / 12);
  assert.equal(parseProduction([text])[0].feet, 3 + 7 / 12);
  assert.equal(productionHeightFeet("Height: sloped"), null);
});
if (process.env.ROHIT_REVIEW) {
  test("all real Rohit pages match bundle membership without using report footage", () => {
    const dir = process.env.ROHIT_REVIEW,
      production = JSON.parse(readFileSync(dir + "/production.json")),
      report = JSON.parse(readFileSync(dir + "/bundles.json"));
    validatePackageLevels(production, report, "L1");
    const walls = parseProduction(production),
      bundles = parseBundles(report, walls);
    assert.equal(production.length, 311);
    assert.equal(walls.length, 232);
    assert.equal(bundles.length, 18);
    assert.ok(walls.every((p) => p.pages.includes(p.page)));
    assert.ok(walls.some((p) => p.pages.length > 1));
    assert.equal(bundles[0].count, 13);
    assert.ok(
      Math.abs(walls.reduce((s, p) => s + p.feet, 0) - 1550.2604166666667) <
        1e-8,
    );
  });
}
