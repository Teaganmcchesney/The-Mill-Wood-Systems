import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
mkdirSync("public/pdfjs", { recursive: true });
for (const name of ["pdf.min.mjs", "pdf.worker.min.mjs"])
  copyFileSync(
    require.resolve(`pdfjs-dist/build/${name}`),
    `public/pdfjs/${name}`,
  );
