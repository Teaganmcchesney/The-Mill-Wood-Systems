import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import "./copy-pdf-worker.mjs";
const mode = process.argv[2];
if (mode !== "build" && mode !== "dev")
  throw new Error("Expected build or dev");
const require = createRequire(import.meta.url);
// One immutable release identifier is compiled into both the browser and API.
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), mode, ...process.argv.slice(3)],
  {
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_APP_VERSION: randomUUID() },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
