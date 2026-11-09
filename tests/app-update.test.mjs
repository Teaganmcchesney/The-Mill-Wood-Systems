import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(
  readFileSync(new URL("../lib/app-update-policy.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022 } },
).outputText;
const { emptyRelease, observeRelease, canApplyRelease, recentlyAttempted } =
  await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  );
const context = {
  now: 20000,
  lastInteraction: 0,
  online: true,
  visible: true,
  focused: true,
  blocked: false,
  pointerDown: false,
};
test("a release requires two consistent observations and an idle app", () => {
  const one = observeRelease("A", emptyRelease(), "B", 1000);
  assert.equal(canApplyRelease(one, context), false);
  const two = observeRelease("A", one, "B", 4000);
  assert.equal(canApplyRelease(two, context), true);
  assert.equal(
    canApplyRelease(two, { ...context, lastInteraction: 19000 }),
    false,
  );
  assert.equal(canApplyRelease(two, { ...context, now: 100000 }), false);
});
test("uploads, QA/QC, dirty edits, dragging and inactive/offline screens prevent release reloads", () => {
  const state = observeRelease(
    "A",
    observeRelease("A", emptyRelease(), "B", 1000),
    "B",
    4000,
  );
  for (const patch of [
    { blocked: true },
    { pointerDown: true },
    { online: false },
    { visible: false },
    { focused: false },
  ])
    assert.equal(canApplyRelease(state, { ...context, ...patch }), false);
});
test("rollbacks, invalid replies and changing releases do not produce false reloads", () => {
  const state = observeRelease(
    "A",
    observeRelease("A", emptyRelease(), "B", 1000),
    "B",
    4000,
  );
  for (const value of [null, undefined, "", "<html>login</html>", 4])
    assert.deepEqual(observeRelease("A", state, value, 5000), state);
  assert.deepEqual(observeRelease("A", state, "A", 5000), emptyRelease());
  assert.equal(
    canApplyRelease(observeRelease("A", state, "C", 5000), context),
    false,
  );
});
test("a failed refresh cannot loop against the same release", () => {
  const raw = JSON.stringify({ from: "A", to: "B", at: 1000 });
  assert.equal(recentlyAttempted(raw, "A", "B", 2000), true);
  assert.equal(recentlyAttempted(raw, "A", "B", 400000), false);
  assert.equal(recentlyAttempted(raw, "B", "C", 2000), false);
  assert.equal(recentlyAttempted("invalid", "A", "B", 2000), false);
});
