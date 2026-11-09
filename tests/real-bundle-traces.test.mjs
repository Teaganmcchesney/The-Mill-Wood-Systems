import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const load = async (name) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        ts.transpileModule(
          readFileSync(new URL("../lib/" + name, import.meta.url), "utf8"),
          {
            compilerOptions: {
              module: ts.ModuleKind.ES2022,
              target: ts.ScriptTarget.ES2022,
            },
          },
        ).outputText,
      ).toString("base64")
  );
for (const [name, dir, file, count] of [
  [
    "Chinook",
    process.env.CHINOOK_REVIEW,
    process.env.CHINOOK_REVIEW &&
      process.env.CHINOOK_REVIEW + "/bundle-source.pdf",
    39,
  ],
  ["Rohit", process.env.ROHIT_REVIEW, process.env.ROHIT_BUNDLE_PDF, 18],
  ["Parapet", process.env.PARAPET_REVIEW, process.env.PARAPET_BUNDLE_PDF, 5],
]) {
  if (!dir || !file) continue;
  test(
    name +
      " real bundle traces match every panel, including rotated cross-sections",
    async () => {
      const { getDocument, OPS } =
        await import("pdfjs-dist/legacy/build/pdf.mjs");
      const { parseProduction, parseBundles, productionHeightFeet } =
          await load("package-parser.ts"),
        { extractWallRectangles, traceMatchesProduction } =
          await load("bundle-trace.ts");
      const production = JSON.parse(readFileSync(dir + "/production.json")),
        walls = parseProduction(production),
        bundles = parseBundles(
          JSON.parse(readFileSync(dir + "/bundles.json")),
          walls,
        );
      const pdf = await getDocument({
        data: new Uint8Array(readFileSync(file)),
      }).promise;
      try {
        assert.equal(bundles.length, count);
        for (const bundle of bundles) {
          const page = await pdf.getPage(bundle.page),
            vp = page.getViewport({ scale: 1 });
          const outlines = extractWallRectangles(
            await page.getOperatorList(),
            OPS,
            vp,
          );
          assert.equal(
            outlines.length,
            bundle.count,
            bundle.id + " exact wall count",
          );
          assert.ok(
            traceMatchesProduction(
              outlines,
              bundle.members.map((w) => w.feet),
              vp.width,
              bundle.members.map(
                (w) => productionHeightFeet(production[w.page - 1]) ?? 0,
              ),
            ),
            bundle.id + " production dimension sequence",
          );
          page.cleanup();
        }
      } finally {
        await pdf.destroy();
      }
    },
  );
}
