import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(
  readFileSync(new URL("../lib/bundle-trace.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { extractWallRectangles, traceMatchesProduction } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const ops = {
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  closePath: 18,
  rectangle: 19,
  fill: 22,
  stroke: 20,
  constructPath: 91,
  setFillRGBColor: 59,
};
const viewport = {
  width: 1000,
  height: 800,
  convertToViewportPoint: (x, y) => [x, 800 - y],
};
function drawing() {
  return {
    fnArray: [10, 59, 91, 22, 11],
    argsArray: [
      null,
      new Uint8Array([205, 133, 63]),
      [
        [13, 14, 14, 14, 18],
        [70, 100, 520, 100, 520, 111, 70, 111],
      ],
      null,
      null,
    ],
  };
}
test("traces the closed wood-body vector without retaining PDF sheet details", () => {
  const list = drawing(),
    points = extractWallRectangles(list, ops, viewport);
  assert.equal(points.length, 1);
  assert.deepEqual(points[0], [
    { x: 0.07, y: 689 / 800 },
    { x: 0.52, y: 689 / 800 },
    { x: 0.52, y: 0.875 },
    { x: 0.07, y: 0.875 },
  ]);
  list.argsArray[1] = [0, 0, 0];
  assert.equal(extractWallRectangles(list, ops, viewport).length, 0);
});
test("rejects thin sheathing strips and mismatched production identities", () => {
  const list = drawing();
  list.argsArray[2][1] = [70, 100, 520, 100, 520, 101, 70, 101];
  assert.equal(extractWallRectangles(list, ops, viewport).length, 0);
  const rect = (w) => [
    { x: 0, y: 0.5 },
    { x: w, y: 0.5 },
    { x: w, y: 0.52 },
    { x: 0, y: 0.52 },
  ];
  assert.equal(
    traceMatchesProduction([rect(0.4), rect(0.2)], [20, 10], 1000),
    true,
  );
  assert.equal(
    traceMatchesProduction([rect(0.4), rect(0.2)], [10, 20], 1000),
    false,
  );
  assert.equal(traceMatchesProduction([rect(0.4)], [20, 10], 1000), false);
});
