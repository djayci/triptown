// Bundles the Hono app into a single Vercel function using the Build Output API v3.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const out = ".vercel/output";
const fn = `${out}/functions/api.func`;
rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

await build({
  entryPoints: ["src/vercel.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: `${fn}/index.mjs`,
  banner: { js: "import { createRequire } from \"node:module\"; const require = createRequire(import.meta.url);" },
});

writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", supportsResponseStreaming: true, maxDuration: 90 }, null, 2),
);
writeFileSync(`${fn}/package.json`, JSON.stringify({ type: "module" }));
writeFileSync(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [{ src: "/(.*)", dest: "/api" }],
      // Daily software integrity self-check (GLI-19 §2.3.2).
      crons: [
        { path: "/v1/admin/integrity/cron", schedule: "17 3 * * *" },
        // Void/refund and missed-credit repair (compliance-baseline D17).
        { path: "/v1/admin/reconcile/cron", schedule: "*/5 * * * *" },
      ],
    },
    null,
    2,
  ),
);
// Signed hash manifest of the function bundle, verified at cold start, daily and on demand.
execFileSync("node", ["../../scripts/release-manifest.mjs", fn], { stdio: "inherit" });
console.info("built", fn);
