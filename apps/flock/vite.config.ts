import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
// The rules panel shows the build identity, which a lab checks against the signed manifest.
const build = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
})();

const tunnelHosts = process.env.TUNNEL_HOSTS?.split(",").filter(Boolean) ?? [];
const allowedHosts = tunnelHosts.length > 0 ? { allowedHosts: tunnelHosts } : {};

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_HASH__: JSON.stringify(process.env.GIT_SHA ?? build),
  },
  // Operators may embed in sandboxed iframes (opaque origin), which need CORS for module scripts and assets.
  // TUNNEL_HOSTS opens the host check for a temporary tunnel (ngrok, cloudflared) when testing on a real
  // phone. Off unless set, because a dev server also serves source over /@fs.
  server: { cors: { origin: "*" }, ...allowedHosts },
  preview: { cors: { origin: "*" }, ...allowedHosts },
  build: { target: "es2022" },
});
